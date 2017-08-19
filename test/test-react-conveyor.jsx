import React from 'react';
import {mount, shallow} from 'enzyme';

import {omit} from '../src/utils';
import Conveyor from '../src/index';
import * as helpers from './_helpers';

const promiseFactories = () => ({
  foo: helpers.controlledPromiseFactory(),
  bar: helpers.controlledPromiseFactory(),
});

// `div` triggers a warning when passed invalid props.
const CustomChild = () => <div></div>;

describe('ReactConveyor', function() {

  it('exposes correct props for initial render', function () {
    const children = props => <CustomChild {...props}/>;
    const fetch = promiseFactories();

    // Use `shallow` as this will not mount and not trigger the
    // `componentDidMount` lifecycle hook.
    const wrapper = shallow(<Conveyor fetch={fetch}>{children}</Conveyor>);

    expect(wrapper.props()).toEqual({
      bar: undefined,
      foo: undefined,
      errors: null,
      missing: ['foo', 'bar'],
      inFlight: null,
      reload: wrapper.instance().reload,
    });
  });

  it('calls all fragments on mounting', function () {
    const children = props => <CustomChild {...props}/>;
    const fetch = promiseFactories();
    const extraProps = {
      someProp: 1,
      someOtherProp: true,
    };
    mount(<Conveyor {...extraProps} fetch={fetch}>{children}</Conveyor>);

    expect(fetch.foo.calledOnce).toBe(true);
    expect(fetch.foo.args[0]).toEqual([extraProps]);

    expect(fetch.bar.calledOnce).toBe(true);
    expect(fetch.bar.args[0]).toEqual([extraProps]);
  });

  it('forwards extra props to children', function () {
    const children = props => <CustomChild {...props}/>;
    const fetch = promiseFactories();

    const wrapper = mount(
      <Conveyor someProp={1} someOtherProp fetch={fetch}>{children}</Conveyor>
    );

    const props = wrapper.find(CustomChild).first().props();
    expect(props.someProp).toBe(1);
    expect(props.someOtherProp).toBe(true);
  });

  it('exposes correct props after mounting', function () {
    const children = props => <CustomChild {...props}/>;
    const fetch = promiseFactories();

    const wrapper = mount(<Conveyor fetch={fetch}>{children}</Conveyor>);

    expect(wrapper.find(CustomChild).first().props()).toEqual({
      bar: undefined,
      foo: undefined,
      errors: null,
      missing: null,
      inFlight: ['foo', 'bar'],
      reload: wrapper.instance().reload,
    });
  });

  it('exposes correct props after fragments have resolved / rejected', async function () {
    const children = props => <CustomChild {...props}/>;
    const fetch = promiseFactories();
    const wrapper = mount(<Conveyor fetch={fetch}>{children}</Conveyor>);

    const fooValue = {};
    const barError = new Error('Bar');
    fetch.foo.resolve(0, fooValue);
    fetch.bar.reject(0, barError);

    await helpers.sleep(0);
    wrapper.update(); // External async update so we need to force re-render.

    const props = wrapper.find(CustomChild).first().props();

    expect(props.foo).toBe(fooValue);
    expect(props.bar).toBe(undefined);
    expect(props.errors.bar).toBe(barError);
    expect(props.inFlight).toBe(null);
    expect(props.missing).toBe(null);
    expect(props.reload).toBe(wrapper.instance().reload);
  });

  it('reloads fragments when props change', function () {
    const children = props => <CustomChild {...props}/>;
    const fetch = {foo: helpers.controlledPromiseFactory()};
    const wrapper = mount(<Conveyor someProp={1} fetch={fetch}>{children}</Conveyor>);

    wrapper.setProps({someProp: 2});

    expect(fetch.foo.calledTwice).toBe(true);
    expect(fetch.foo.args).toEqual([
      [ { someProp: 1 } ],
      [ { someProp: 2 } ]
    ]);
  });

  it('resolves race conditions when promises resolve in the wrong order', async function () {
    const children = props => <CustomChild {...props}/>;
    const fetch = {foo: helpers.controlledPromiseFactory()};
    const wrapper = mount(<Conveyor someProp={1} fetch={fetch}>{children}</Conveyor>);

    wrapper.setProps({someProp: 2});

    fetch.foo.resolve(1, 1);

    await helpers.sleep(0);
    wrapper.update(); // External async update so we need to force re-render.

    const props = wrapper.find(CustomChild).first().props();

    expect(props.foo).toBe(1);
    expect(props.errors).toBe(null);

    fetch.foo.reject(0, new Error('foo'));

    await helpers.sleep(0);
    wrapper.update(); // External async update so we need to force re-render.

    expect(props.foo).toBe(1);
    expect(props.errors).toBe(null);
  });

  it('honors `mapPropsToArgs` when calling fragments', function () {
    const children = props => <CustomChild {...props}/>;
    const fetch = promiseFactories();

    const mapPropsToArgs = {
      foo: x => ({value: x.fooInputValue}),
      bar: x => ({value: x.barInputValue}),
    };

    const extraProps = {
      fooInputValue: 1,
      barInputValue: 2,
    };

    mount(
      <Conveyor {...extraProps} fetch={fetch} mapPropsToArgs={mapPropsToArgs}>
        {children}
      </Conveyor>
    );

    expect(fetch.foo.calledOnce).toBe(true);
    expect(fetch.foo.args[0]).toEqual([{value: 1}]);

    expect(fetch.bar.calledOnce).toBe(true);
    expect(fetch.bar.args[0]).toEqual([{value: 2}]);
  });

  it('honors `mapPropsToArgs` when receiving props', async function () {
    const children = props => <CustomChild {...props}/>;
    const fetch = promiseFactories();

    const mapPropsToArgs = {
      foo: x => ({value: x.fooInputValue}),
      bar: x => ({value: x.barInputValue}),
    };

    const extraProps = {
      fooInputValue: 1,
      barInputValue: 2,
    };

    const wrapper = mount(
      <Conveyor {...extraProps} fetch={fetch} mapPropsToArgs={mapPropsToArgs}>
        {children}
      </Conveyor>
    );

    wrapper.setProps({barInputValue: 3});

    expect(fetch.foo.calledOnce).toBe(true); // Did not reload
    expect(fetch.foo.args[0]).toEqual([{value: 1}]);

    expect(fetch.bar.calledTwice).toBe(true);
    expect(fetch.bar.args).toEqual([
      [{value: 2}],
      [{value: 3}],
    ]);
  });

  it('only reloads affected fragments when `mapPropsToArgs` return value changes', function () {
    // Had a case where reloading when the function changed but the result
    // didn't was undesirable.
    const children = props => <CustomChild {...props}/>;
    const fetch = promiseFactories();

    const mapPropsToArgs = {
      foo: x => ({value: x.fooInputValue}),
      bar: x => ({value: x.barInputValue}),
    };

    const extraProps = {
      fooInputValue: 1,
      barInputValue: 2,
    };

    const wrapper = mount(
      <Conveyor {...extraProps} fetch={fetch} mapPropsToArgs={mapPropsToArgs}>
        {children}
      </Conveyor>
    );

    const nextMapPropsToArgs = {
      foo: x => ({value: x.fooInputValue}),
      bar: x => ({value: x.barInputValue + 1}),
    };

    wrapper.setProps({mapPropsToArgs: nextMapPropsToArgs});

    expect(fetch.foo.calledOnce).toBe(true); // Did not reload
    expect(fetch.foo.args[0]).toEqual([{value: 1}]);

    expect(fetch.bar.calledTwice).toBe(true);
    expect(fetch.bar.args).toEqual([
      [{value: 2}],
      [{value: 3}],
    ]);

  });

  it('auto-refreshes globally when provided a number', async function () {
    const children = props => <CustomChild {...props}/>;
    const fetch = promiseFactories();

    mount(
      <Conveyor fetch={fetch} refresh={20}>
        {children}
      </Conveyor>
    );

    fetch.foo.resolve(0, 1);
    fetch.bar.resolve(0, 2);

    await helpers.sleep(30);

    expect(fetch.foo.calledTwice).toBe(true);
    expect(fetch.bar.calledTwice).toBe(true);

    fetch.foo.resolve(1, 1);
    fetch.bar.resolve(1, 2);

    await helpers.sleep(30);

    expect(fetch.foo.calledThrice).toBe(true);
    expect(fetch.bar.calledThrice).toBe(true);
  });

  it('auto-refreshes per fragment when provided an object', async function () {
    const children = props => <CustomChild {...props}/>;
    const fetch = promiseFactories();

    mount(
      <Conveyor fetch={fetch} refresh={{foo: 20}}>
        {children}
      </Conveyor>
    );

    fetch.foo.resolve(0, 1);
    fetch.bar.resolve(0, 2);

    await helpers.sleep(30);

    expect(fetch.foo.calledTwice).toBe(true);
    expect(fetch.bar.calledOnce).toBe(true);

    fetch.foo.resolve(1, 1);

    await helpers.sleep(30);

    expect(fetch.foo.calledThrice).toBe(true);
    expect(fetch.bar.calledOnce).toBe(true);
  });

  it('does not auto-refresh until fragment resolves', async function () {
    // Avoid unnecessary race-conditions and function calls
    const children = props => <CustomChild {...props}/>;
    const fetch = promiseFactories();

    mount(
      <Conveyor fetch={fetch} refresh={{foo: 20}}>
        {children}
      </Conveyor>
    );

    await helpers.sleep(30);

    expect(fetch.foo.calledOnce).toBe(true);
    fetch.foo.resolve(0, 1);

    await helpers.sleep(30);

    expect(fetch.foo.calledTwice).toBe(true);
  });

  it('does not auto-refresh on fragment rejection', async function () {
    // Avoid unnecessary race-conditions and function calls
    const children = props => <CustomChild {...props}/>;
    const fetch = promiseFactories();

    mount(
      <Conveyor fetch={fetch} refresh={{foo: 20}}>
        {children}
      </Conveyor>
    );

    fetch.foo.reject(0, new Error('Foo failed.'));

    await helpers.sleep(30);

    expect(fetch.foo.calledOnce).toBe(true);
  });
});

describe('ReactConveyor.wrapComponent', function() {
  it('returns a Component function that renders ReactConveyor correctly', function () {
    const defaultProps = {
      fetch: promiseFactories(),
      mapPropsToArgs: {
        foo: props => props.fooInput,
      },
    };
    const ComponentWithData = Conveyor.wrapComponent(defaultProps, CustomChild);

    const wrapper = mount(<ComponentWithData fooInput={1} refresh={5000}/>);

    const conveyorProps = wrapper.find(Conveyor).first().props();

    expect(conveyorProps.fetch).toBe(defaultProps.fetch);
    expect(conveyorProps.mapPropsToArgs).toBe(defaultProps.mapPropsToArgs);
    expect(conveyorProps.refresh).toBe(5000);

    const childrenProps = wrapper.find(CustomChild).first().props();

    expect(omit(childrenProps, ['reload'])).toEqual({
      bar: undefined,
      foo: undefined,
      errors: null,
      missing: null,
      inFlight: ['foo', 'bar'],
      fooInput: 1,
    });
  });
});
