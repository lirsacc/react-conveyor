/**
 * Some very basic utility functions.
 */

/**
 * Shallow equals assuming plain objects or arrays as input.
 *
 * @param {object} obj1
 * @param {object} obj2
 * @returns {boolean}
 */
export function shallowEqual(obj1, obj2) {
  if (obj1 === obj2) {
    return true;
  }

  if (obj1 == null || obj2 == null) {
    return false;
  }

  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    return (
      obj1.length === obj2.length
      && obj1.every((value, index) => value === obj2[index])
    );
  }

  if (typeof obj1 === 'object' && typeof obj2 === 'object') {
    const props1 = Object.keys(obj1);
    const props2 = Object.keys(obj2);
    const obj2HasProp = obj2.hasOwnProperty.bind(obj2);
    return (
      props1.length === props2.length
      && props1.every(prop => obj2HasProp(prop) && obj1[prop] === obj2[prop])
    );
  }

  return false;
}

/**
 * Extract keys from a plain object.
 *
 * @param {object} obj
 * @param {string[]} keys
 * @returns {object}
 */
export function omit(obj, keys) {
  if (!keys || !keys.length) return obj;
  return (
    Object
      .keys(obj)
      .filter(key => keys.indexOf(key) === -1)
      .reduce((reduced, key) => ({...reduced, [key]: obj[key]}), {})
  );
}
