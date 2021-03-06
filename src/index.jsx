import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';

import {shallowEqual, omit, pick, isObject, isFunction} from './utils';

const UNDEF = 0;
const FAILED = 1;
const IN_FLIGHT = 2;
const READY = 3;

const _mapWithDefaults = (keys, defaultValue) => keys.reduce((map, name) => {
  map[name] = defaultValue;
  return map;
}, {});

/**
 * Wrapper component to abstract data fetching through promises and render props.
 *
 * @class ReactConveyor
 * @extends {React.PureComponent}
 */
export default class ReactConveyor extends PureComponent {

  constructor(props) {
    super(props);

    const fields = this.fields();
    const mutations = this.mutations();

    this.state = {
      status: _mapWithDefaults([...fields, ...mutations], UNDEF),
      data: _mapWithDefaults(fields, undefined),
      errors: _mapWithDefaults([...fields, ...mutations], undefined),
    };

    // Will be used to track race conditions during promise resolution.
    this._latestPromise = _mapWithDefaults([...fields, ...mutations], undefined);

    this.reload = this.reload.bind(this);
    this.fetch = this.fetch.bind(this);
    this.fields = this.fields.bind(this);
    this.mutations = this.mutations.bind(this);
    this.fieldsWithStatus = this.fieldsWithStatus.bind(this);
    this.mutationsWithStatus = this.mutationsWithStatus.bind(this);
    this.boundMutations = this.boundMutations.bind(this);
    this.callMutation = this.callMutation.bind(this);

    // To avoid generating new functions all the time.
    this._mutations = this.boundMutations();
  }

  componentDidMount() {
    this._mounted = true;
    this.fieldsWithStatus(UNDEF).forEach(this.fetch);
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  componentDidUpdate(prevProps) {
    if (shallowEqual(prevProps, this.props)) {
      return;
    }

    const needsReloading = field => {
      const factoryChanged = this.props.fields[field] !== prevProps.fields[field];
      const realArgs = props => ReactConveyor.mapPropsToArgs(props, field);
      const argsChanged = !shallowEqual(realArgs(this.props), realArgs(prevProps));
      return this.props.fields[field] && (factoryChanged || argsChanged);
    };

    this.fields().filter(needsReloading).forEach(
      field => this.setState(
        state => ({
          ...state,
          status: { ...state.status, [field]: UNDEF },
          errors: { ...state.errors, [field]: null },
        }),
        () => this.fetch(field)
      )
    );

    this._mutations = this.boundMutations();
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

  boundMutations() {
    return this.mutations().reduce((map, mutation) => {
      const func = this.props.mutations[mutation];
      const bound = (...args) => this.callMutation(mutation, func, ...args);
      return { ...map, [mutation]: bound };
    }, {});
  }

  callMutation(mutation, mutator, ...args) {
    if (!isFunction(mutator)) {
      throw new TypeError(`Invalid mutator ${mutation}. Expected function.`);
    }

    if (this.state.status[mutation] === IN_FLIGHT) {
      return Promise.reject(new Error(`Mutation ${mutation} already in progress.`));
    }

    this.setState(state => ({
      ...state,
      status: { ...state.status, [mutation]: IN_FLIGHT },
      errors: { ...state.errors, [mutation]: null },
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

        let nextData = null;

        if (isFunction(result)) {
          nextData = result(this.state.data);
        } else {
          nextData = result;
        }

        this.setState(state => ({...state, status: { ...state.status, [mutation]: UNDEF }}));

        if (isObject(nextData)) {
          nextData = pick(nextData, this.fields());
          const replaced = Object.keys(nextData);

          this.setState(state => ({
            ...state,
            status: { ...state.status, ..._mapWithDefaults(replaced, READY) },
            errors: { ...state.errors, ..._mapWithDefaults(replaced, null) },
            data: { ...state.data, ...nextData },
          }));
        }
      }),
    ).catch(guarded(error => {
      this.setState(state => ({
        ...state,
        status: { ...state.status, [mutation]: FAILED },
        errors: { ...state.errors, [mutation]: error },
      }));
      throw error;
    }));
  }

  fetch(field) {
    const promiseFactory = this.props.fields[field];

    if (!isFunction(promiseFactory)) {
      throw new TypeError(`Invalid field ${field}. Expected function.`);
    }

    if (this.state.status[field] === IN_FLIGHT) {
      return Promise.resolve();
    }

    this.setState(state => ({
      ...state,
      status: { ...state.status, [field]: IN_FLIGHT },
      errors: { ...state.errors, [field]: undefined },
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
        state => ({
          ...state,
          status: { ...state.status, [field]: READY },
          errors: { ...state.errors, [field]: undefined },
          data: { ...state.data, [field]: result },
        })
      ))
    ).catch(
      guarded(error => this.setState(
        state => ({
          ...state,
          status: { ...state.status, [field]: FAILED },
          errors: { ...state.errors, [field]: error },
          data: { ...state.data, [field]: undefined },
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
      ...this.fieldsWithStatus(UNDEF),
    ];
    const inFlightMutations = this.mutationsWithStatus(IN_FLIGHT);
    const failed = [
      ...this.fieldsWithStatus(FAILED),
      ...this.mutationsWithStatus(FAILED),
    ];

    const ifLength = value => value.length ? value : null;

    return this.props.children({
      inFlight: ifLength(inFlight),
      inFlightMutations: ifLength(inFlightMutations),
      errors: failed.length ? this.state.errors : null,
      reload: this.reload,
      ...ReactConveyor.forwardedProps(this.props),
      ...this._mutations,
      ...this.state.data,
    });
  }
}

ReactConveyor.propTypes = {
  /**
   * Render prop: this is your component.
   *
   * type: (props: {
   *    inFlight: string[]|null,
   *    inFlightMutations: string[]|null,
   *    errors: { [key: string]: Error }|null,
   *    reload: () => void,
   *    ...fields: object,
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
   * Resolved values will be used to replace the current state: an object
   * will be merged with the current fields while a function will be called
   * to generate the object to be merged.
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
};

ReactConveyor.defaultProps = {
  mapPropsToArgs: {},
  mutations: {},
};

const _CONVEYOR_PROPS = Object.keys(ReactConveyor.propTypes);

ReactConveyor.forwardedProps = function forwardedProps(props) {
  return omit(props, _CONVEYOR_PROPS);
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
 * @param {object} defaultProps - `ReactConveyor` props, `fields` is mandatory.
 * @param {React.Component|React.StatelessComponent} Component
 * @returns {React.StatelessComponent}
 */
ReactConveyor.wrapComponent = function wrapComponent(defaultProps, Component) {

  // Avoid outside manipulation after definition
  const staticProps = {...defaultProps};

  if (!('fields' in staticProps)) {
    throw TypeError('Expected `fields` to be provided when wrapping component.');
  }

  const children = renderProps => <Component {...renderProps}/>;

  const wrapper = function(props) {
    const conveyorProps = omit({...props, ...staticProps}, ['children']);
    return (
      <ReactConveyor {...conveyorProps}>
        {children}
      </ReactConveyor>
    );
  };

  wrapper.displayName = `${Component.displayName || 'Anonymous'}ReactConveyor`;

  return wrapper;
};
