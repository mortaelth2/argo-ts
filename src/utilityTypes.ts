type NonAny = number | boolean | string | symbol | null;
export type DeepOptional<T> = {
    [P in keyof T]?: T[P] extends NonAny[] // checks for nested any[]
        ? T[P]
        : T[P] extends ReadonlyArray<NonAny> // checks for nested ReadonlyArray<any>
          ? T[P]
          : T[P] extends Date // checks for Date
            ? T[P]
            : T[P] extends (infer U)[]
              ? DeepOptional<U>[]
              : T[P] extends ReadonlyArray<infer U>
                ? ReadonlyArray<DeepOptional<U>>
                : T[P] extends Set<infer V> // checks for Sets
                  ? Set<DeepOptional<V>>
                  : T[P] extends Map<infer K, infer V> // checks for Maps
                    ? Map<K, DeepOptional<V>>
                    : T[P] extends NonAny // checks for primative values
                      ? T[P]
                      : DeepOptional<T[P]>; // recurse for all non-array, non-date and non-primative values
};

export type DeepRequired<T> = {
    [P in keyof T]-?: T[P] extends NonAny[] // checks for nested any[]
        ? T[P]
        : T[P] extends ReadonlyArray<NonAny> // checks for nested ReadonlyArray<any>
          ? T[P]
          : T[P] extends Date // checks for Date
            ? T[P]
            : T[P] extends (infer U)[]
              ? DeepRequired<U>[]
              : T[P] extends ReadonlyArray<infer U>
                ? ReadonlyArray<DeepRequired<U>>
                : T[P] extends Set<infer V> // checks for Sets
                  ? Set<DeepRequired<V>>
                  : T[P] extends Map<infer K, infer V> // checks for Maps
                    ? Map<K, DeepRequired<V>>
                    : T[P] extends NonAny // checks for primative values
                      ? T[P]
                      : DeepRequired<T[P]>; // recurse for all non-array, non-date and non-primative values
};
