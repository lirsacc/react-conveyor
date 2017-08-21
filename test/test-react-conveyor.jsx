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

  it('exposes correct props for initial render', function() {
    const children = props => <CustomChild {...props}/>;
    const fields = promiseFactories();

    // Use `shallow` as this will not mount and not trigger the
    // `componentDidMount` lifecycle hook.
    const wrapper = shallow(<Conveyor fields={fields}>{children}</Conveyor>);

    expect(wrapper.props()).toEqual({
      bar: undefined,
      foo: undefined,
      errors: null,
      missing: ['foo', 'bar'],
      inFlight: null,
      reload: wrapper.instance().reload,
    });
  });

  it('calls all fields on mounting', function() {
    const children = props => <CustomChild {...props}/>;
    const fields = promiseFactories();
    const extraProps = {
      someProp: 1,
      someOtherProp: true,
    };
    mount(<Conveyor {...extraProps} fields={fields}>{children}</Conveyor>);

    expect(fields.foo.calledOnce).toBe(true);
    expect(fields.foo.args[0]).toEqual([extraProps]);

    expect(fields.bar.calledOnce).toBe(true);
    expect(fields.bar.args[0]).toEqual([extraProps]);
  });

  it('forwards extra props to children', function() {
    const children = props => <CustomChild {...props}/>;
    const fields = promiseFactories();

    const wrapper = mount(
      <Conveyor someProp={1} someOtherProp fields={fields}>{children}</Conveyor>
    );

    const props = wrapper.find(CustomChild).first().props();
    expect(props.someProp).toBe(1);
    expect(props.someOtherProp).toBe(true);
  });

  it('exposes correct props after mounting', function() {
    const children = props => <CustomChild {...props}/>;
    const fields = promiseFactories();

    const wrapper = mount(<Conveyor fields={fields}>{children}</Conveyor>);

    expect(wrapper.find(CustomChild).first().props()).toEqual({
      bar: undefined,
      foo: undefined,
      errors: null,
      missing: null,
      inFlight: ['foo', 'bar'],
      reload: wrapper.instance().reload,
    });
  });

  it('exposes correct props after fields have resolved / rejected', async function() {
    const children = props => <CustomChild {...props}/>;
    const fields = promiseFactories();
    const wrapper = mount(<Conveyor fields={fields}>{children}</Conveyor>);

    const fooValue = {};
    const barError = new Error('Bar');
    fields.foo.resolve(0, fooValue);
    fields.bar.reject(0, barError);

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

  it('reloads fields when props change', function() {
    const children = props => <CustomChild {...props}/>;
    const fields = {foo: helpers.controlledPromiseFactory()};
    const wrapper = mount(<Conveyor someProp={1} fields={fields}>{children}</Conveyor>);

    wrapper.setProps({someProp: 2});

    expect(fields.foo.calledTwice).toBe(true);
    expect(fields.foo.args).toEqual([
      [ { someProp: 1 } ],
      [ { someProp: 2 } ]
    ]);
  });

  it('resolves race conditions when promises resolve in the wrong order', async function() {
    const children = props => <CustomChild {...props}/>;
    const fields = {foo: helpers.controlledPromiseFactory()};
    const wrapper = mount(<Conveyor someProp={1} fields={fields}>{children}</Conveyor>);

    wrapper.setProps({someProp: 2});

    fields.foo.resolve(1, 1);

    await helpers.sleep(0);
    wrapper.update(); // External async update so we need to force re-render.

    const props = wrapper.find(CustomChild).first().props();

    expect(props.foo).toBe(1);
    expect(props.errors).toBe(null);

    fields.foo.reject(0, new Error('foo'));

    await helpers.sleep(0);
    wrapper.update(); // External async update so we need to force re-render.

    expect(props.foo).toBe(1);
    expect(props.errors).toBe(null);
  });

  it('honors `mapPropsToArgs` when calling fields', function() {
    const children = props => <CustomChild {...props}/>;
    const fields = promiseFactories();

    const mapPropsToArgs = {
      foo: x => ({value: x.fooInputValue}),
      bar: x => ({value: x.barInputValue}),
    };

    const extraProps = {
      fooInputValue: 1,
      barInputValue: 2,
    };

    mount(
      <Conveyor {...extraProps} fields={fields} mapPropsToArgs={mapPropsToArgs}>
        {children}
      </Conveyor>
    );

    expect(fields.foo.calledOnce).toBe(true);
    expect(fields.foo.args[0]).toEqual([{value: 1}]);

    expect(fields.bar.calledOnce).toBe(true);
    expect(fields.bar.args[0]).toEqual([{value: 2}]);
  });

  it('honors `mapPropsToArgs` when receiving props', async function() {
    const children = props => <CustomChild {...props}/>;
    const fields = promiseFactories();

    const mapPropsToArgs = {
      foo: x => ({value: x.fooInputValue}),
      bar: x => ({value: x.barInputValue}),
    };

    const extraProps = {
      fooInputValue: 1,
      barInputValue: 2,
    };

    const wrapper = mount(
      <Conveyor {...extraProps} fields={fields} mapPropsToArgs={mapPropsToArgs}>
        {children}
      </Conveyor>
    );

    wrapper.setProps({barInputValue: 3});

    expect(fields.foo.calledOnce).toBe(true); // Did not reload
    expect(fields.foo.args[0]).toEqual([{value: 1}]);

    expect(fields.bar.calledTwice).toBe(true);
    expect(fields.bar.args).toEqual([
      [{value: 2}],
      [{value: 3}],
    ]);
  });

  it('only reloads affected fields when `mapPropsToArgs` return value changes', function() {
    // Had a case where reloading when the function changed but the result
    // didn't was undesirable.
    const children = props => <CustomChild {...props}/>;
    const fields = promiseFactories();

    const mapPropsToArgs = {
      foo: x => ({value: x.fooInputValue}),
      bar: x => ({value: x.barInputValue}),
    };

    const extraProps = {
      fooInputValue: 1,
      barInputValue: 2,
    };

    const wrapper = mount(
      <Conveyor {...extraProps} fields={fields} mapPropsToArgs={mapPropsToArgs}>
        {children}
      </Conveyor>
    );

    const nextMapPropsToArgs = {
      foo: x => ({value: x.fooInputValue}),
      bar: x => ({value: x.barInputValue + 1}),
    };

    wrapper.setProps({mapPropsToArgs: nextMapPropsToArgs});

    expect(fields.foo.calledOnce).toBe(true); // Did not reload
    expect(fields.foo.args[0]).toEqual([{value: 1}]);

    expect(fields.bar.calledTwice).toBe(true);
    expect(fields.bar.args).toEqual([
      [{value: 2}],
      [{value: 3}],
    ]);

  });

  it('auto-refreshes globally when provided a number', async function() {
    const children = props => <CustomChild {...props}/>;
    const fields = promiseFactories();

    mount(
      <Conveyor fields={fields} refresh={20}>
        {children}
      </Conveyor>
    );

    fields.foo.resolve(0, 1);
    fields.bar.resolve(0, 2);

    await helpers.sleep(30);

    expect(fields.foo.calledTwice).toBe(true);
    expect(fields.bar.calledTwice).toBe(true);

    fields.foo.resolve(1, 1);
    fields.bar.resolve(1, 2);

    await helpers.sleep(30);

    expect(fields.foo.calledThrice).toBe(true);
    expect(fields.bar.calledThrice).toBe(true);
  });

  it('auto-refreshes per field when provided an object', async function() {
    const children = props => <CustomChild {...props}/>;
    const fields = promiseFactories();

    mount(
      <Conveyor fields={fields} refresh={{foo: 20}}>
        {children}
      </Conveyor>
    );

    fields.foo.resolve(0, 1);
    fields.bar.resolve(0, 2);

    await helpers.sleep(30);

    expect(fields.foo.calledTwice).toBe(true);
    expect(fields.bar.calledOnce).toBe(true);

    fields.foo.resolve(1, 1);

    await helpers.sleep(30);

    expect(fields.foo.calledThrice).toBe(true);
    expect(fields.bar.calledOnce).toBe(true);
  });

  it('does not auto-refresh until field resolves', async function() {
    // Avoid unnecessary race-conditions and function calls
    const children = props => <CustomChild {...props}/>;
    const fields = promiseFactories();

    mount(
      <Conveyor fields={fields} refresh={{foo: 20}}>
        {children}
      </Conveyor>
    );

    await helpers.sleep(30);

    expect(fields.foo.calledOnce).toBe(true);
    fields.foo.resolve(0, 1);

    await helpers.sleep(30);

    expect(fields.foo.calledTwice).toBe(true);
  });

  it('does not auto-refresh on field rejection', async function() {
    // Avoid unnecessary race-conditions and function calls
    const children = props => <CustomChild {...props}/>;
    const fields = promiseFactories();

    mount(
      <Conveyor fields={fields} refresh={{foo: 20}}>
        {children}
      </Conveyor>
    );

    fields.foo.reject(0, new Error('Foo failed.'));

    await helpers.sleep(30);

    expect(fields.foo.calledOnce).toBe(true);
  });
});

describe('ReactConveyor.wrapComponent', function() {

  it('returns a Component function that renders ReactConveyor correctly', function() {
    const defaultProps = {
      fields: promiseFactories(),
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
