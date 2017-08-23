/**
 * Some very basic utility functions.
 */

/**
 * Shallow equality check.
 *
 * @param {object} obj1
 * @param {object} obj2
 * @returns {boolean}
 */
export function shallowEqual(obj1, obj2) {
  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;

  for (let i in obj1) {
    if (!(i in obj2)) {
      return false;
    }
  }

  for (let i in obj2) {
    if (obj1[i] !== obj2[i]) {
      return false;
    }
  }

  return true;
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
