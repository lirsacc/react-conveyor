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

    const fields = this.fields();

    const defaults = defaultValue => this.fields().reduce((map, name) => {
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
    this.fields = this.fields.bind(this);
    this.scheduleRefresh = this.scheduleRefresh.bind(this);
    this.fieldsWithStatus = this.fieldsWithStatus.bind(this);
  }

  componentDidMount() {
    this._mounted = true;
    this.fieldsWithStatus(MISSING).forEach(this.fetch);
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  componentWillReceiveProps(nextProps) {
    if (shallowEqual(nextProps, this.props)) {
      return;
    }

    const needsReloading = field => {
      const factoryChanged = this.props.fields[field] !== nextProps.fields[field];
      const argsChanged = !shallowEqual(
        ReactConveyor.mapPropsToArgs(this.props, field),
        ReactConveyor.mapPropsToArgs(nextProps, field)
      );
      return nextProps.fields[field] && (factoryChanged || argsChanged);
    };

    this.fields().filter(needsReloading).forEach(
      field => this.setState(
        this.updateFieldState(field, {status: MISSING, errors: null}),
        () => this.fetch(field)
      )
    );
  }

  updateFieldState(field, updates) {
    return state => {
      return Object.keys(updates).reduce((next, key) => {
        return {
          ...next,
          [key]: {...next[key], [field]: updates[key]}
        };
      }, state);
    };
  }

  fields() {
    return Object.keys(this.props.fields);
  }

  fieldsWithStatus(status) {
    return this.fields().filter(name => this.state.status[name] === status);
  }

  scheduleRefresh(field) {
    const refreshInterval = typeof this.props.refresh === 'number' ? this.props.refresh : this.props.refresh[field];
    if (refreshInterval > 0) {
      setTimeout(() => this.fetch(field), refreshInterval);
    }
  }

  fetch(field) {
    const promiseFactory = this.props.fields[field];

    if (typeof promiseFactory !== 'function') {
      throw new TypeError(`Invalid field ${field}. Expected function.`);
    }

    if (this.state.status[field] === IN_FLIGHT) {
      return Promise.resolve();
    }

    this.setState(this.updateFieldState(field, {
      status: IN_FLIGHT,
      errors: undefined
    }));

    const args = ReactConveyor.mapPropsToArgs(this.props, field);
    const promise = promiseFactory(args);

    this._latestPromise[field] = promise;

    const guarded = func => (...args) => {
      if (this._mounted && this._latestPromise[field] === promise) {
        return func(...args);
      }
    };

    return promise.then(
      guarded(result => this.setState(
        this.updateFieldState(field, {
          status: FETCHED,
          data: result,
          errors: undefined
        }),
        () => this.scheduleRefresh(field)
      ))
    ).catch(
      guarded(error => this.setState(
        this.updateFieldState(field, {
          status: FAILED,
          data: undefined,
          errors: error
        })
      ))
    );
  }

  reload(field) {
    if (field == null) {
      this.fields().forEach(this.fetch);
    } else {
      this.fetch(field);
    }
  }

  render() {
    const inFlight = this.fieldsWithStatus(IN_FLIGHT);
    const failed = this.fieldsWithStatus(FAILED);
    const missing = this.fieldsWithStatus(MISSING);

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
  fields: PropTypes.objectOf(PropTypes.func).isRequired,

  /**
   * Argument mappers.
   * Must have the same keys as `fields`.
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
  refresh: 0,
};

ReactConveyor.forwardedProps = function forwardedProps(props) {
  return omit(props, Object.keys(ReactConveyor.propTypes));
};

ReactConveyor.mapPropsToArgs = function mapPropsToArgs(props, field) {
  const mapper = props.mapPropsToArgs[field];
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
 *   fields: { [key: string]: (prop: object) => Promise<any> },
 *   mapPropsToArgs: { [key: string]: (prop: object) => any }|null,
 *   refresh: number|{ [key: string]: number }|null,
 * }} defaultProps - `ReactConveyor` props
 * @param {React.Component|React.StatelessComponent} Component
 * @returns {React.StatelessComponent}
 */
ReactConveyor.wrapComponent = function wrapComponent(defaultProps, Component) {

  // Avoid outside manipulation after definition
  const staticProps = {...defaultProps};

  if (!('fields' in staticProps)) {
    throw TypeError('Expected `fields` to be provided when wrapping component.');
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
