import {omit, shallowEqual} from '../src/utils';

describe('omit', function () {

  it('removes keys from object', function () {
    expect(
      omit({foo: 1, bar: 2, baz: 3}, ['bar'])
    ).toEqual({foo: 1, baz: 3,});
  });

  it('does not unnecessarily modify the input', function () {
    const input = {foo: 1, bar: 2, baz: 3};
    expect(omit(input, [])).toBe(input);
  });

});

describe('shallowEqual', function () {
  it('is true for same object', function () {
    const input = {foo: 1, bar: '2', baz: {}};
    expect(shallowEqual(input, input)).toBe(true);
  });

  it('is true for shallow equal objects', function () {
    const input = {foo: 1, bar: '2', baz: {}};
    expect(shallowEqual(input, {...input})).toBe(true);
  });

  it('is true for same arrays', function () {
    const input = [1, 'foo', {}];
    expect(shallowEqual(input, input)).toBe(true);
  });

  it('is true for shallow equal arrays', function () {
    const input = [1, 'foo', {}];
    expect(shallowEqual(input, [...input])).toBe(true);
  });

  it('is false for object and array', function () {
    expect(
      shallowEqual([1, 'foo', {}], {foo: 1, bar: '2', baz: {}})
    ).toBe(false);
  });

  it('is false for different length arrays', function () {
    expect(shallowEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it('is false for objects with non matching keys', function () {
    expect(shallowEqual({foo: 1, bar: 2}, {foo: 1, baz: 3})).toBe(false);
  });

  it('is false for object and null', function () {
    expect(
      shallowEqual(null, {foo: 1, bar: '2', baz: {}})
    ).toBe(false);
  });

  it('is true for equal primitives', function () {
    expect(shallowEqual(1, 1)).toBe(true);
    expect(shallowEqual(true, true)).toBe(true);
    expect(shallowEqual(null, null)).toBe(true);
    expect(shallowEqual('foo', 'foo')).toBe(true);
  });

  it('is false for different primitives', function () {
    expect(shallowEqual(1, 2)).toBe(false);
    expect(shallowEqual(true, false)).toBe(false);
    expect(shallowEqual(null, undefined)).toBe(false);
    expect(shallowEqual('foo', 'bar')).toBe(false);
  });
});
