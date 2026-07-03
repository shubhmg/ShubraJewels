// Returns an object with only the requested keys that are present on the source.
export default function pick(obj, keys) {
  return keys.reduce((acc, key) => {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key)) acc[key] = obj[key];
    return acc;
  }, {});
}
