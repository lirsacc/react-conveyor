import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';

import {shallowEqual, omit} from './utils';

const MISSING = 0;
const FAILED = 1;
const IN_FLIGHT = 2;
const FETCHED = 3;

/**
 * Very basic Higher order component to abstract data fetching through promises.
 *
 * @class ReactConveyor
 * @extends {React.PureComponent}
 */
export default class ReactConveyor extends PureComponent {

  constructor(props) {
    super(props);

    const fragments = this.fragments();

    const defaults = defaultValue => fragments.reduce((map, name) => {
      map[name] = defaultValue;
      return map;
    }, {});

    this.state = {
      status: defaults(MISSING),
      data: defaults(undefined),
      errors: defaults(undefined),
    };

    // Will be used to track race conditions during promise resolution.
    this._latestPromise = defaults(undefined);

    this.reload = this.reload.bind(this);
    this.fetch = this.fetch.bind(this);
    this.fragments = this.fragments.bind(this);
    this.scheduleRefresh = this.scheduleRefresh.bind(this);
    this.fragmentsWithStatus = this.fragmentsWithStatus.bind(this);
  }

  componentDidMount() {
    this._mounted = true;
    this.fragmentsWithStatus(MISSING).forEach(this.fetch);
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  componentWillReceiveProps(nextProps) {
    if (shallowEqual(nextProps, this.props)) {
      return;
    }

    const needsReloading = fragment => {
      const factoryChanged = this.props.fetch[fragment] !== nextProps.fetch[fragment];
      const argsChanged = !shallowEqual(
        ReactConveyor.mapPropsToArgs(this.props, fragment),
        ReactConveyor.mapPropsToArgs(nextProps, fragment)
      );
      return nextProps.fetch[fragment] && (factoryChanged || argsChanged);
    };

    this.fragments().filter(needsReloading).forEach(
      fragment => this.setState(state => {
        return {
          status: {...state.status, [fragment]: MISSING},
          errors: {...state.errors, [fragment]: null},
        };
      }, () => this.fetch(fragment))
    );
  }

  fragments() {
    return Object.keys(this.props.fetch);
  }

  fragmentsWithStatus(status) {
    return this.fragments().filter(name => this.state.status[name] === status);
  }

  scheduleRefresh(fragment) {
    if (this.props.refresh == null) return;
    const refreshInterval = (
      typeof this.props.refresh === 'number'
        ? this.props.refresh
        : (this.props.refresh[fragment] || 0)
    );
    if (refreshInterval > 0) {
      setTimeout(() => this.fetch(fragment), refreshInterval);
    }
  }

  fetch(fragment) {
    const promiseFactory = this.props.fetch[fragment];

    if (typeof promiseFactory !== 'function') {
      throw new TypeError(`Invalid fragment ${fragment}. Expected function.`);
    }

    this.setState(state => {
      return {
        status: {...state.status, [fragment]: IN_FLIGHT},
        errors: {...state.errors, [fragment]: null},
      };
    });

    const props = ReactConveyor.mapPropsToArgs(this.props, fragment);
    const promise = promiseFactory(props);

    this._latestPromise[fragment] = promise;

    const guarded = func => (...args) => {
      if (this._mounted && this._latestPromise[fragment] === promise) {
        return func(...args);
      }
    };

    return promise.then(
      guarded(result => this.setState(state => {
        return {
          status: {...state.status, [fragment]: FETCHED},
          errors: {...state.errors, [fragment]: undefined},
          data: {...state.data, [fragment]: result},
        };
      }, () => this.scheduleRefresh(fragment)))
    ).catch(
      error => this.setState(state => {
        return {
          status: {...state.status, [fragment]: FAILED},
          errors: {...state.errors, [fragment]: error},
          data: {...state.data, [fragment]: undefined},
        };
      })
    );
  }

  reload(fragment) {
    if (fragment == null) {
      this.fragments().forEach(this.fetch);
    } else {
      this.fetch(fragment);
    }
  }

  render() {
    const inFlight = this.fragmentsWithStatus(IN_FLIGHT);
    const failed = this.fragmentsWithStatus(FAILED);
    const missing = this.fragmentsWithStatus(MISSING);

    const ifLength = value => value.length ? value : null;

    return this.props.children({
      missing: ifLength(missing),
      inFlight: ifLength(inFlight),
      errors: failed.length ? this.state.errors : null,
      reload: this.reload,
      ...ReactConveyor.forwardedProps(this.props),
      ...this.state.data,
    });
  }
}

ReactConveyor.propTypes = {
  /**
   * Children as a function.
   *
   * type: (props: {
   *    missing: string[]|null,
   *    inFlight: string[]|null,
   *    errors: { [key: string]: Error }|null,
   *    reload: () => void,
   *    ...rest: object,
   * }) => React.ReactNode
   */
  children: PropTypes.func.isRequired,

  /**
   * Map of promise factories. All the factories must accept one argument.
   *
   * type: { [key: string]: (prop: any) => Promise<any> }
   */
  fetch: PropTypes.objectOf(PropTypes.func).isRequired,

  /**
   * Argument mappers.
   * Must have the same keys as `fetch`.
   *
   * type: { [key: string]: (prop: object) => any }
   */
  mapPropsToArgs: PropTypes.objectOf(PropTypes.func),

  /**
   * Provide any number greater than 0 to activate auto-refresh
   * for all (single number) or some of the properties (map of numbers).
   * Number should be in milliseconds.
   *
   * type: number|{ [key: string]: number }|null
   */
  refresh: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.objectOf(PropTypes.number),
  ]),
};

ReactConveyor.defaultProps = {
  mapPropsToArgs: {},
};

ReactConveyor.forwardedProps = function forwardedProps(props) {
  return omit(props, Object.keys(ReactConveyor.propTypes));
};

ReactConveyor.mapPropsToArgs = function mapPropsToArgs(props, fragment) {
  const mapper = props.mapPropsToArgs[fragment];
  const filteredProps = ReactConveyor.forwardedProps(props);
  if (mapper == null) {
    return filteredProps;
  } else {
    return mapper(filteredProps);
  }
};

/**
 * Statically wrap a component (standard Higher Order Component pattern).
 *
 * @param {{
 *   fetch: { [key: string]: (prop: object) => Promise<any> },
 *   mapPropsToArgs: { [key: string]: (prop: object) => any }|null,
 *   refresh: number|{ [key: string]: number }|null,
 * }} defaultProps - `ReactConveyor` props
 * @param {React.Component|React.StatelessComponent} Component
 * @returns {React.StatelessComponent}
 */
ReactConveyor.wrapComponent = function wrapComponent(defaultProps, Component) {

  // Avoid outside manipulation after definition
  const staticProps = {...defaultProps};

  if (!('fetch' in staticProps)) {
    throw TypeError('Expected `fetch` to be provided when wrapping component.');
  }

  const wrapper = function(props) {
    const conveyorProps = omit({...props, ...staticProps}, ['children']);
    return (
      <ReactConveyor {...conveyorProps}>
        {renderProps => <Component {...renderProps}/>}
      </ReactConveyor>
    );
  };

  wrapper.displayName = `${Component.displayName || 'Anonymous'}ReactConveyor`;

  return wrapper;
};
