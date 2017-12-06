import React from 'react';
import {mount, shallow} from 'enzyme';

import {omit} from '../src/utils';
import Conveyor from '../src/index';
import * as helpers from './_helpers';

const promiseFactories = () => ({
  foo: helpers.controlledPromiseFactory(),
  bar: helpers.controlledPromiseFactory(),
});

// Wrapper needed because `div` triggers a warning when passed invalid props.
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

  it('it forward mutations to children', async function() {
    const children = props => <CustomChild {...props}/>;
    const fields = {foo: helpers.controlledPromiseFactory()};

    const mutations = {
      mutateFoo: helpers.controlledPromiseFactory(),
    };

    const wrapper = mount(
      <Conveyor fields={fields} mutations={mutations}>
        {children}
      </Conveyor>
    );

    fields.foo.resolve(0, 1);

    await helpers.sleep(0);
    wrapper.update();

    const childProps = wrapper.find(CustomChild).first().props();
    expect(typeof childProps.mutateFoo).toBe('function');
    expect(childProps.inFlight).toBe(null);
    expect(childProps.missing).toBe(null);
    expect(childProps.errors).toBe(null);
    expect(mutations.mutateFoo.called).toBe(false);
  });

  it('it forward mutations state to children', async function() {
    const children = props => <CustomChild {...props}/>;
    const fields = {foo: helpers.controlledPromiseFactory()};

    const mutations = {
      mutateFoo: helpers.controlledPromiseFactory(),
    };

    const wrapper = mount(
      <Conveyor fields={fields} mutations={mutations}>
        {children}
      </Conveyor>
    );

    fields.foo.resolve(0, 1);

    await helpers.sleep(0);
    wrapper.update();

    let childProps = wrapper.find(CustomChild).first().props();

    childProps.mutateFoo();

    await helpers.sleep(0);
    wrapper.update();

    childProps = wrapper.find(CustomChild).first().props();
    expect(mutations.mutateFoo.calledOnce).toBe(true);
    expect(childProps.inFlight).toEqual(['mutateFoo']);
    expect(childProps.errors).toBe(null);

    mutations.mutateFoo.resolve(0, 1);
    await helpers.sleep(0);
    wrapper.update();

    childProps = wrapper.find(CustomChild).first().props();
    expect(mutations.mutateFoo.calledOnce).toBe(true);
    expect(childProps.inFlight).toBe(null);
    expect(childProps.errors).toBe(null);

    childProps.mutateFoo();
    const err = new Error('Failed mutation.');
    mutations.mutateFoo.reject(1, err);

    await helpers.sleep(0);
    wrapper.update();

    childProps = wrapper.find(CustomChild).first().props();
    expect(mutations.mutateFoo.calledTwice).toBe(true);
    expect(childProps.inFlight).toEqual(null);
    expect(childProps.errors).toEqual({
      mutateFoo: err,
    });
  });

  it('replaces field content if replaceOnMutation is set', async function() {
    const children = props => <CustomChild {...props}/>;
    const fields = {foo: helpers.controlledPromiseFactory()};

    const mutations = {
      mutateFoo: helpers.controlledPromiseFactory(),
    };

    const replaceOnMutation = {
      mutateFoo: 'foo',
    };

    const wrapper = mount(
      <Conveyor fields={fields} mutations={mutations} replaceOnMutation={replaceOnMutation}>
        {children}
      </Conveyor>
    );

    fields.foo.resolve(0, 1);

    await helpers.sleep(0);
    wrapper.update();

    let childProps = wrapper.find(CustomChild).first().props();

    expect(childProps.foo).toBe(1);

    childProps.mutateFoo();
    mutations.mutateFoo.resolve(0, 2);

    await helpers.sleep(0);
    wrapper.update();

    childProps = wrapper.find(CustomChild).first().props();
    expect(childProps.foo).toBe(2);
    expect(childProps.inFlight).toBe(null);
    expect(childProps.errors).toBe(null);
  });

  it('exposes a reload function to reload single fields', async function() {
    const children = props => <CustomChild {...props}/>;
    const fields = promiseFactories();

    const wrapper = mount(<Conveyor fields={fields}>{children}</Conveyor>);

    fields.foo.resolve(0, 'foo');
    fields.bar.resolve(0, 'bar');

    await helpers.sleep(0);
    wrapper.update();

    const reload = wrapper.find(CustomChild).first().props().reload;

    reload('foo');

    expect(fields.foo.calledTwice).toBe(true);
    expect(fields.bar.calledOnce).toBe(true);
  });

  it('exposes a reload function to reload all fields', async function() {
    const children = props => <CustomChild {...props}/>;
    const fields = promiseFactories();

    const wrapper = mount(<Conveyor fields={fields}>{children}</Conveyor>);

    fields.foo.resolve(0, 'foo');
    fields.bar.resolve(0, 'bar');

    await helpers.sleep(0);
    wrapper.update();

    const reload = wrapper.find(CustomChild).first().props().reload;

    reload();

    expect(fields.foo.calledTwice).toBe(true);
    expect(fields.bar.calledTwice).toBe(true);
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

    const wrapper = mount(<ComponentWithData fooInput={1}/>);

    const conveyorProps = wrapper.find(Conveyor).first().props();

    expect(conveyorProps.fetch).toBe(defaultProps.fetch);
    expect(conveyorProps.mapPropsToArgs).toBe(defaultProps.mapPropsToArgs);

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
