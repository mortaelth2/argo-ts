import * as _ from "lodash";
/**
 * Merges multiple objects, and removes any keys with null values in the resulting object.
 * Similar to lodash merge() but with null value removal.
 */
export function mergeAndUnsetNulls(target: any, ...sources: any[]): any {
    // First, do a regular merge with all sources
    const merged = _.merge(_.cloneDeep(target), ...sources);

    // Then, recursively remove all null values using omitBy
    function removeNulls(obj: any): any {
        if (!_.isPlainObject(obj)) return obj;

        return _.omitBy(
            _.mapValues(obj, (value) => (_.isPlainObject(value) ? removeNulls(value) : value)),
            _.isNull,
        );
    }

    return removeNulls(merged);
}
