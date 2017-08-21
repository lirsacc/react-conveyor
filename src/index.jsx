import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';

import {shallowEqual, omit} from './utils';

const UNDEF = 0;
const FAILED = 1;
const IN_FLIGHT = 2;
const READY = 3;

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
    const mutations = this.mutations();

    const defaults = (keys, defaultValue) => keys.reduce((map, name) => {
      map[name] = defaultValue;
      return map;
    }, {});

    this.state = {
      status: defaults([...fields, ...mutations], UNDEF),
      data: defaults(fields, undefined),
      errors: defaults([...fields, ...mutations], undefined),
    };

    // Will be used to track race conditions during promise resolution.
    this._latestPromise = defaults([...fields, ...mutations], undefined);

    // To avoid generating new functions all the time.
    this._boundMutationsCache = {};

    this.reload = this.reload.bind(this);
    this.fetch = this.fetch.bind(this);
    this.fields = this.fields.bind(this);
    this.mutations = this.mutations.bind(this);
    this.scheduleRefresh = this.scheduleRefresh.bind(this);
    this.fieldsWithStatus = this.fieldsWithStatus.bind(this);
    this.mutationsWithStatus = this.mutationsWithStatus.bind(this);
    this.boundMutations = this.boundMutations.bind(this);
    this.callMutator = this.callMutator.bind(this);
  }

  componentDidMount() {
    this._mounted = true;
    this.fieldsWithStatus(UNDEF).forEach(this.fetch);
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
        this.updateFieldState(field, {status: UNDEF, errors: null}),
        () => this.fetch(field)
      )
    );
  }

  updateFieldState(fieldOrMutation, updates) {
    return state => {
      return Object.keys(updates).reduce((next, key) => {
        return {
          ...next,
          [key]: {...next[key], [fieldOrMutation]: updates[key]}
        };
      }, state);
    };
  }

  fields() {
    return Object.keys(this.props.fields);
  }

  mutations() {
    return Object.keys(this.props.mutations);
  }

  fieldsWithStatus(status) {
    return this.fields().filter(name => this.state.status[name] === status);
  }

  mutationsWithStatus(status) {
    return this.mutations().filter(name => this.state.status[name] === status);
  }

  scheduleRefresh(field) {
    const refreshInterval = typeof this.props.refresh === 'number' ? this.props.refresh : this.props.refresh[field];
    if (refreshInterval > 0) {
      setTimeout(() => this.fetch(field), refreshInterval);
    }
  }

  boundMutations() {
    return this.mutations().reduce((map, mutation) => {
      const {cached, original} = this._boundMutationsCache[mutation] || {};
      const current = this.props.mutations[mutation];
      if (!(cached && original === current)) {
        const bound = (...args) => {
          return this.callMutator(mutation, current, ...args);
        };
        this._boundMutationsCache[mutation] = {cached: bound, original: current};
      }
      return {...map, [mutation]: this._boundMutationsCache[mutation].cached};
    }, {});
  }

  callMutator(mutation, mutator, ...args) {
    if (typeof mutator !== 'function') {
      throw new TypeError(`Invalid mutator ${mutation}. Expected function.`);
    }

    if (this.state.status[mutation] === IN_FLIGHT) {
      return Promise.reject(new Error(`Mutation ${mutation} already in progress.`));
    }

    this.setState(this.updateFieldState(mutation, {
      status: IN_FLIGHT,
      errors: null
    }));

    const promise = mutator(...args);
    this._latestPromise[mutation] = promise;

    const guarded = func => (...args) => {
      if (this._mounted && this._latestPromise[mutation] === promise) {
        return func(...args);
      }
    };

    return promise.then(
      guarded(result => {
        this.setState(this.updateFieldState(mutation, {status: UNDEF}));
        return result;
      })
    ).catch(
      guarded(error => this.setState(this.updateFieldState(mutation, {
        status: FAILED,
        errors: error,
      })))
    );
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
          status: READY,
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
    const inFlight = [
      ...this.fieldsWithStatus(IN_FLIGHT),
      ...this.mutationsWithStatus(IN_FLIGHT)
    ];
    const failed = [
      ...this.fieldsWithStatus(FAILED),
      ...this.mutationsWithStatus(FAILED)
    ];
    const missing = this.fieldsWithStatus(UNDEF);

    const ifLength = value => value.length ? value : null;

    return this.props.children({
      missing: ifLength(missing),
      inFlight: ifLength(inFlight),
      errors: failed.length ? this.state.errors : null,
      reload: this.reload,
      ...ReactConveyor.forwardedProps(this.props),
      ...this.boundMutations(),
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
   * Map of mutation promise factories.
   * Keys must not conflict with `props.fields`.
   *
   * type: { [key: string]: (prop: ...any[]) => Promise<any> }
   */
  mutations: PropTypes.objectOf(PropTypes.func),

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
  mutations: {},
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
 *   fields: { [key: string]: (prop: any) => Promise<any> },
 *   mutations: { [key: string]: (prop: ...any[]) => Promise<any> },
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
