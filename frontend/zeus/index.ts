/* eslint-disable */

import { AllTypesProps, ReturnTypes, Ops } from './const';
export const HOST = "http://127.0.0.1:1337/graphql"


export const HEADERS = {}
export const apiSubscription = (options: chainOptions) => (query: string) => {
  try {
    const queryString = options[0] + '?query=' + encodeURIComponent(query);
    const wsString = queryString.replace('http', 'ws');
    const host = (options.length > 1 && options[1]?.websocket?.[0]) || wsString;
    const webSocketOptions = options[1]?.websocket || [host];
    const ws = new WebSocket(...webSocketOptions);
    return {
      ws,
      on: (e: (args: any) => void) => {
        ws.onmessage = (event: any) => {
          if (event.data) {
            const parsed = JSON.parse(event.data);
            const data = parsed.data;
            return e(data);
          }
        };
      },
      off: (e: (args: any) => void) => {
        ws.onclose = e;
      },
      error: (e: (args: any) => void) => {
        ws.onerror = e;
      },
      open: (e: () => void) => {
        ws.onopen = e;
      },
    };
  } catch {
    throw new Error('No websockets implemented');
  }
};
const handleFetchResponse = (response: Response): Promise<GraphQLResponse> => {
  if (!response.ok) {
    return new Promise((_, reject) => {
      response
        .text()
        .then((text) => {
          try {
            reject(JSON.parse(text));
          } catch (err) {
            reject(text);
          }
        })
        .catch(reject);
    });
  }
  return response.json() as Promise<GraphQLResponse>;
};

export const apiFetch =
  (options: fetchOptions) =>
  (query: string, variables: Record<string, unknown> = {}) => {
    const fetchOptions = options[1] || {};
    if (fetchOptions.method && fetchOptions.method === 'GET') {
      return fetch(`${options[0]}?query=${encodeURIComponent(query)}`, fetchOptions)
        .then(handleFetchResponse)
        .then((response: GraphQLResponse) => {
          if (response.errors) {
            throw new GraphQLError(response);
          }
          return response.data;
        });
    }
    return fetch(`${options[0]}`, {
      body: JSON.stringify({ query, variables }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      ...fetchOptions,
    })
      .then(handleFetchResponse)
      .then((response: GraphQLResponse) => {
        if (response.errors) {
          throw new GraphQLError(response);
        }
        return response.data;
      });
  };

export const InternalsBuildQuery = ({
  ops,
  props,
  returns,
  options,
  scalars,
}: {
  props: AllTypesPropsType;
  returns: ReturnTypesType;
  ops: Operations;
  options?: OperationOptions;
  scalars?: ScalarDefinition;
}) => {
  const ibb = (
    k: string,
    o: InputValueType | VType,
    p = '',
    root = true,
    vars: Array<{ name: string; graphQLType: string }> = [],
  ): string => {
    const keyForPath = purifyGraphQLKey(k);
    const newPath = [p, keyForPath].join(SEPARATOR);
    if (!o) {
      return '';
    }
    if (typeof o === 'boolean' || typeof o === 'number') {
      return k;
    }
    if (typeof o === 'string') {
      return `${k} ${o}`;
    }
    if (Array.isArray(o)) {
      const args = InternalArgsBuilt({
        props,
        returns,
        ops,
        scalars,
        vars,
      })(o[0], newPath);
      return `${ibb(args ? `${k}(${args})` : k, o[1], p, false, vars)}`;
    }
    if (k === '__alias') {
      return Object.entries(o)
        .map(([alias, objectUnderAlias]) => {
          if (typeof objectUnderAlias !== 'object' || Array.isArray(objectUnderAlias)) {
            throw new Error(
              'Invalid alias it should be __alias:{ YOUR_ALIAS_NAME: { OPERATION_NAME: { ...selectors }}}',
            );
          }
          const operationName = Object.keys(objectUnderAlias)[0];
          const operation = objectUnderAlias[operationName];
          return ibb(`${alias}:${operationName}`, operation, p, false, vars);
        })
        .join('\n');
    }
    const hasOperationName = root && options?.operationName ? ' ' + options.operationName : '';
    const keyForDirectives = o.__directives ?? '';
    const query = `{${Object.entries(o)
      .filter(([k]) => k !== '__directives')
      .map((e) => ibb(...e, [p, `field<>${keyForPath}`].join(SEPARATOR), false, vars))
      .join('\n')}}`;
    if (!root) {
      return `${k} ${keyForDirectives}${hasOperationName} ${query}`;
    }
    const varsString = vars.map((v) => `${v.name}: ${v.graphQLType}`).join(', ');
    return `${k} ${keyForDirectives}${hasOperationName}${varsString ? `(${varsString})` : ''} ${query}`;
  };
  return ibb;
};

export const Thunder =
  (fn: FetchFunction) =>
  <O extends keyof typeof Ops, SCLR extends ScalarDefinition, R extends keyof ValueTypes = GenericOperation<O>>(
    operation: O,
    graphqlOptions?: ThunderGraphQLOptions<SCLR>,
  ) =>
  <Z extends ValueTypes[R]>(o: Z | ValueTypes[R], ops?: OperationOptions & { variables?: Record<string, unknown> }) =>
    fn(
      Zeus(operation, o, {
        operationOptions: ops,
        scalars: graphqlOptions?.scalars,
      }),
      ops?.variables,
    ).then((data) => {
      if (graphqlOptions?.scalars) {
        return decodeScalarsInResponse({
          response: data,
          initialOp: operation,
          initialZeusQuery: o as VType,
          returns: ReturnTypes,
          scalars: graphqlOptions.scalars,
          ops: Ops,
        });
      }
      return data;
    }) as Promise<InputType<GraphQLTypes[R], Z, SCLR>>;

export const Chain = (...options: chainOptions) => Thunder(apiFetch(options));

export const SubscriptionThunder =
  (fn: SubscriptionFunction) =>
  <O extends keyof typeof Ops, SCLR extends ScalarDefinition, R extends keyof ValueTypes = GenericOperation<O>>(
    operation: O,
    graphqlOptions?: ThunderGraphQLOptions<SCLR>,
  ) =>
  <Z extends ValueTypes[R]>(o: Z | ValueTypes[R], ops?: OperationOptions & { variables?: ExtractVariables<Z> }) => {
    const returnedFunction = fn(
      Zeus(operation, o, {
        operationOptions: ops,
        scalars: graphqlOptions?.scalars,
      }),
    ) as SubscriptionToGraphQL<Z, GraphQLTypes[R], SCLR>;
    if (returnedFunction?.on && graphqlOptions?.scalars) {
      const wrapped = returnedFunction.on;
      returnedFunction.on = (fnToCall: (args: InputType<GraphQLTypes[R], Z, SCLR>) => void) =>
        wrapped((data: InputType<GraphQLTypes[R], Z, SCLR>) => {
          if (graphqlOptions?.scalars) {
            return fnToCall(
              decodeScalarsInResponse({
                response: data,
                initialOp: operation,
                initialZeusQuery: o as VType,
                returns: ReturnTypes,
                scalars: graphqlOptions.scalars,
                ops: Ops,
              }),
            );
          }
          return fnToCall(data);
        });
    }
    return returnedFunction;
  };

export const Subscription = (...options: chainOptions) => SubscriptionThunder(apiSubscription(options));
export const Zeus = <
  Z extends ValueTypes[R],
  O extends keyof typeof Ops,
  R extends keyof ValueTypes = GenericOperation<O>,
>(
  operation: O,
  o: Z | ValueTypes[R],
  ops?: {
    operationOptions?: OperationOptions;
    scalars?: ScalarDefinition;
  },
) =>
  InternalsBuildQuery({
    props: AllTypesProps,
    returns: ReturnTypes,
    ops: Ops,
    options: ops?.operationOptions,
    scalars: ops?.scalars,
  })(operation, o as VType);

export const ZeusSelect = <T>() => ((t: unknown) => t) as SelectionFunction<T>;

export const Selector = <T extends keyof ValueTypes>(key: T) => key && ZeusSelect<ValueTypes[T]>();

export const TypeFromSelector = <T extends keyof ValueTypes>(key: T) => key && ZeusSelect<ValueTypes[T]>();
export const Gql = Chain(HOST, {
  headers: {
    'Content-Type': 'application/json',
    ...HEADERS,
  },
});

export const ZeusScalars = ZeusSelect<ScalarCoders>();

export const decodeScalarsInResponse = <O extends Operations>({
  response,
  scalars,
  returns,
  ops,
  initialZeusQuery,
  initialOp,
}: {
  ops: O;
  response: any;
  returns: ReturnTypesType;
  scalars?: Record<string, ScalarResolver | undefined>;
  initialOp: keyof O;
  initialZeusQuery: InputValueType | VType;
}) => {
  if (!scalars) {
    return response;
  }
  const builder = PrepareScalarPaths({
    ops,
    returns,
  });

  const scalarPaths = builder(initialOp as string, ops[initialOp], initialZeusQuery);
  if (scalarPaths) {
    const r = traverseResponse({ scalarPaths, resolvers: scalars })(initialOp as string, response, [ops[initialOp]]);
    return r;
  }
  return response;
};

export const traverseResponse = ({
  resolvers,
  scalarPaths,
}: {
  scalarPaths: { [x: string]: `scalar.${string}` };
  resolvers: {
    [x: string]: ScalarResolver | undefined;
  };
}) => {
  const ibb = (k: string, o: InputValueType | VType, p: string[] = []): unknown => {
    if (Array.isArray(o)) {
      return o.map((eachO) => ibb(k, eachO, p));
    }
    if (o == null) {
      return o;
    }
    const scalarPathString = p.join(SEPARATOR);
    const currentScalarString = scalarPaths[scalarPathString];
    if (currentScalarString) {
      const currentDecoder = resolvers[currentScalarString.split('.')[1]]?.decode;
      if (currentDecoder) {
        return currentDecoder(o);
      }
    }
    if (typeof o === 'boolean' || typeof o === 'number' || typeof o === 'string' || !o) {
      return o;
    }
    const entries = Object.entries(o).map(([k, v]) => [k, ibb(k, v, [...p, purifyGraphQLKey(k)])] as const);
    const objectFromEntries = entries.reduce<Record<string, unknown>>((a, [k, v]) => {
      a[k] = v;
      return a;
    }, {});
    return objectFromEntries;
  };
  return ibb;
};

export type AllTypesPropsType = {
  [x: string]:
    | undefined
    | `scalar.${string}`
    | 'enum'
    | {
        [x: string]:
          | undefined
          | string
          | {
              [x: string]: string | undefined;
            };
      };
};

export type ReturnTypesType = {
  [x: string]:
    | {
        [x: string]: string | undefined;
      }
    | `scalar.${string}`
    | undefined;
};
export type InputValueType = {
  [x: string]: undefined | boolean | string | number | [any, undefined | boolean | InputValueType] | InputValueType;
};
export type VType =
  | undefined
  | boolean
  | string
  | number
  | [any, undefined | boolean | InputValueType]
  | InputValueType;

export type PlainType = boolean | number | string | null | undefined;
export type ZeusArgsType =
  | PlainType
  | {
      [x: string]: ZeusArgsType;
    }
  | Array<ZeusArgsType>;

export type Operations = Record<string, string>;

export type VariableDefinition = {
  [x: string]: unknown;
};

export const SEPARATOR = '|';

export type fetchOptions = Parameters<typeof fetch>;
type websocketOptions = typeof WebSocket extends new (...args: infer R) => WebSocket ? R : never;
export type chainOptions = [fetchOptions[0], fetchOptions[1] & { websocket?: websocketOptions }] | [fetchOptions[0]];
export type FetchFunction = (query: string, variables?: Record<string, unknown>) => Promise<any>;
export type SubscriptionFunction = (query: string) => any;
type NotUndefined<T> = T extends undefined ? never : T;
export type ResolverType<F> = NotUndefined<F extends [infer ARGS, any] ? ARGS : undefined>;

export type OperationOptions = {
  operationName?: string;
};

export type ScalarCoder = Record<string, (s: unknown) => string>;

export interface GraphQLResponse {
  data?: Record<string, any>;
  errors?: Array<{
    message: string;
  }>;
}
export class GraphQLError extends Error {
  constructor(public response: GraphQLResponse) {
    super('');
    console.error(response);
  }
  toString() {
    return 'GraphQL Response Error';
  }
}
export type GenericOperation<O> = O extends keyof typeof Ops ? typeof Ops[O] : never;
export type ThunderGraphQLOptions<SCLR extends ScalarDefinition> = {
  scalars?: SCLR | ScalarCoders;
};

const ExtractScalar = (mappedParts: string[], returns: ReturnTypesType): `scalar.${string}` | undefined => {
  if (mappedParts.length === 0) {
    return;
  }
  const oKey = mappedParts[0];
  const returnP1 = returns[oKey];
  if (typeof returnP1 === 'object') {
    const returnP2 = returnP1[mappedParts[1]];
    if (returnP2) {
      return ExtractScalar([returnP2, ...mappedParts.slice(2)], returns);
    }
    return undefined;
  }
  return returnP1 as `scalar.${string}` | undefined;
};

export const PrepareScalarPaths = ({ ops, returns }: { returns: ReturnTypesType; ops: Operations }) => {
  const ibb = (
    k: string,
    originalKey: string,
    o: InputValueType | VType,
    p: string[] = [],
    pOriginals: string[] = [],
    root = true,
  ): { [x: string]: `scalar.${string}` } | undefined => {
    if (!o) {
      return;
    }
    if (typeof o === 'boolean' || typeof o === 'number' || typeof o === 'string') {
      const extractionArray = [...pOriginals, originalKey];
      const isScalar = ExtractScalar(extractionArray, returns);
      if (isScalar?.startsWith('scalar')) {
        const partOfTree = {
          [[...p, k].join(SEPARATOR)]: isScalar,
        };
        return partOfTree;
      }
      return {};
    }
    if (Array.isArray(o)) {
      return ibb(k, k, o[1], p, pOriginals, false);
    }
    if (k === '__alias') {
      return Object.entries(o)
        .map(([alias, objectUnderAlias]) => {
          if (typeof objectUnderAlias !== 'object' || Array.isArray(objectUnderAlias)) {
            throw new Error(
              'Invalid alias it should be __alias:{ YOUR_ALIAS_NAME: { OPERATION_NAME: { ...selectors }}}',
            );
          }
          const operationName = Object.keys(objectUnderAlias)[0];
          const operation = objectUnderAlias[operationName];
          return ibb(alias, operationName, operation, p, pOriginals, false);
        })
        .reduce((a, b) => ({
          ...a,
          ...b,
        }));
    }
    const keyName = root ? ops[k] : k;
    return Object.entries(o)
      .filter(([k]) => k !== '__directives')
      .map(([k, v]) => {
        // Inline fragments shouldn't be added to the path as they aren't a field
        const isInlineFragment = originalKey.match(/^...\s*on/) != null;
        return ibb(
          k,
          k,
          v,
          isInlineFragment ? p : [...p, purifyGraphQLKey(keyName || k)],
          isInlineFragment ? pOriginals : [...pOriginals, purifyGraphQLKey(originalKey)],
          false,
        );
      })
      .reduce((a, b) => ({
        ...a,
        ...b,
      }));
  };
  return ibb;
};

export const purifyGraphQLKey = (k: string) => k.replace(/\([^)]*\)/g, '').replace(/^[^:]*\:/g, '');

const mapPart = (p: string) => {
  const [isArg, isField] = p.split('<>');
  if (isField) {
    return {
      v: isField,
      __type: 'field',
    } as const;
  }
  return {
    v: isArg,
    __type: 'arg',
  } as const;
};

type Part = ReturnType<typeof mapPart>;

export const ResolveFromPath = (props: AllTypesPropsType, returns: ReturnTypesType, ops: Operations) => {
  const ResolvePropsType = (mappedParts: Part[]) => {
    const oKey = ops[mappedParts[0].v];
    const propsP1 = oKey ? props[oKey] : props[mappedParts[0].v];
    if (propsP1 === 'enum' && mappedParts.length === 1) {
      return 'enum';
    }
    if (typeof propsP1 === 'string' && propsP1.startsWith('scalar.') && mappedParts.length === 1) {
      return propsP1;
    }
    if (typeof propsP1 === 'object') {
      if (mappedParts.length < 2) {
        return 'not';
      }
      const propsP2 = propsP1[mappedParts[1].v];
      if (typeof propsP2 === 'string') {
        return rpp(
          `${propsP2}${SEPARATOR}${mappedParts
            .slice(2)
            .map((mp) => mp.v)
            .join(SEPARATOR)}`,
        );
      }
      if (typeof propsP2 === 'object') {
        if (mappedParts.length < 3) {
          return 'not';
        }
        const propsP3 = propsP2[mappedParts[2].v];
        if (propsP3 && mappedParts[2].__type === 'arg') {
          return rpp(
            `${propsP3}${SEPARATOR}${mappedParts
              .slice(3)
              .map((mp) => mp.v)
              .join(SEPARATOR)}`,
          );
        }
      }
    }
  };
  const ResolveReturnType = (mappedParts: Part[]) => {
    if (mappedParts.length === 0) {
      return 'not';
    }
    const oKey = ops[mappedParts[0].v];
    const returnP1 = oKey ? returns[oKey] : returns[mappedParts[0].v];
    if (typeof returnP1 === 'object') {
      if (mappedParts.length < 2) return 'not';
      const returnP2 = returnP1[mappedParts[1].v];
      if (returnP2) {
        return rpp(
          `${returnP2}${SEPARATOR}${mappedParts
            .slice(2)
            .map((mp) => mp.v)
            .join(SEPARATOR)}`,
        );
      }
    }
  };
  const rpp = (path: string): 'enum' | 'not' | `scalar.${string}` => {
    const parts = path.split(SEPARATOR).filter((l) => l.length > 0);
    const mappedParts = parts.map(mapPart);
    const propsP1 = ResolvePropsType(mappedParts);
    if (propsP1) {
      return propsP1;
    }
    const returnP1 = ResolveReturnType(mappedParts);
    if (returnP1) {
      return returnP1;
    }
    return 'not';
  };
  return rpp;
};

export const InternalArgsBuilt = ({
  props,
  ops,
  returns,
  scalars,
  vars,
}: {
  props: AllTypesPropsType;
  returns: ReturnTypesType;
  ops: Operations;
  scalars?: ScalarDefinition;
  vars: Array<{ name: string; graphQLType: string }>;
}) => {
  const arb = (a: ZeusArgsType, p = '', root = true): string => {
    if (typeof a === 'string') {
      if (a.startsWith(START_VAR_NAME)) {
        const [varName, graphQLType] = a.replace(START_VAR_NAME, '$').split(GRAPHQL_TYPE_SEPARATOR);
        const v = vars.find((v) => v.name === varName);
        if (!v) {
          vars.push({
            name: varName,
            graphQLType,
          });
        } else {
          if (v.graphQLType !== graphQLType) {
            throw new Error(
              `Invalid variable exists with two different GraphQL Types, "${v.graphQLType}" and ${graphQLType}`,
            );
          }
        }
        return varName;
      }
    }
    const checkType = ResolveFromPath(props, returns, ops)(p);
    if (checkType.startsWith('scalar.')) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, ...splittedScalar] = checkType.split('.');
      const scalarKey = splittedScalar.join('.');
      return (scalars?.[scalarKey]?.encode?.(a) as string) || JSON.stringify(a);
    }
    if (Array.isArray(a)) {
      return `[${a.map((arr) => arb(arr, p, false)).join(', ')}]`;
    }
    if (typeof a === 'string') {
      if (checkType === 'enum') {
        return a;
      }
      return `${JSON.stringify(a)}`;
    }
    if (typeof a === 'object') {
      if (a === null) {
        return `null`;
      }
      const returnedObjectString = Object.entries(a)
        .filter(([, v]) => typeof v !== 'undefined')
        .map(([k, v]) => `${k}: ${arb(v, [p, k].join(SEPARATOR), false)}`)
        .join(',\n');
      if (!root) {
        return `{${returnedObjectString}}`;
      }
      return returnedObjectString;
    }
    return `${a}`;
  };
  return arb;
};

export const resolverFor = <X, T extends keyof ResolverInputTypes, Z extends keyof ResolverInputTypes[T]>(
  type: T,
  field: Z,
  fn: (
    args: Required<ResolverInputTypes[T]>[Z] extends [infer Input, any] ? Input : any,
    source: any,
  ) => Z extends keyof ModelTypes[T] ? ModelTypes[T][Z] | Promise<ModelTypes[T][Z]> | X : never,
) => fn as (args?: any, source?: any) => ReturnType<typeof fn>;

export type UnwrapPromise<T> = T extends Promise<infer R> ? R : T;
export type ZeusState<T extends (...args: any[]) => Promise<any>> = NonNullable<UnwrapPromise<ReturnType<T>>>;
export type ZeusHook<
  T extends (...args: any[]) => Record<string, (...args: any[]) => Promise<any>>,
  N extends keyof ReturnType<T>,
> = ZeusState<ReturnType<T>[N]>;

export type WithTypeNameValue<T> = T & {
  __typename?: boolean;
  __directives?: string;
};
export type AliasType<T> = WithTypeNameValue<T> & {
  __alias?: Record<string, WithTypeNameValue<T>>;
};
type DeepAnify<T> = {
  [P in keyof T]?: any;
};
type IsPayLoad<T> = T extends [any, infer PayLoad] ? PayLoad : T;
export type ScalarDefinition = Record<string, ScalarResolver>;

type IsScalar<S, SCLR extends ScalarDefinition> = S extends 'scalar' & { name: infer T }
  ? T extends keyof SCLR
    ? SCLR[T]['decode'] extends (s: unknown) => unknown
      ? ReturnType<SCLR[T]['decode']>
      : unknown
    : unknown
  : S;
type IsArray<T, U, SCLR extends ScalarDefinition> = T extends Array<infer R>
  ? InputType<R, U, SCLR>[]
  : InputType<T, U, SCLR>;
type FlattenArray<T> = T extends Array<infer R> ? R : T;
type BaseZeusResolver = boolean | 1 | string | Variable<any, string>;

type IsInterfaced<SRC extends DeepAnify<DST>, DST, SCLR extends ScalarDefinition> = FlattenArray<SRC> extends
  | ZEUS_INTERFACES
  | ZEUS_UNIONS
  ? {
      [P in keyof SRC]: SRC[P] extends '__union' & infer R
        ? P extends keyof DST
          ? IsArray<R, '__typename' extends keyof DST ? DST[P] & { __typename: true } : DST[P], SCLR>
          : IsArray<R, '__typename' extends keyof DST ? { __typename: true } : never, SCLR>
        : never;
    }[keyof SRC] & {
      [P in keyof Omit<
        Pick<
          SRC,
          {
            [P in keyof DST]: SRC[P] extends '__union' & infer R ? never : P;
          }[keyof DST]
        >,
        '__typename'
      >]: IsPayLoad<DST[P]> extends BaseZeusResolver ? IsScalar<SRC[P], SCLR> : IsArray<SRC[P], DST[P], SCLR>;
    }
  : {
      [P in keyof Pick<SRC, keyof DST>]: IsPayLoad<DST[P]> extends BaseZeusResolver
        ? IsScalar<SRC[P], SCLR>
        : IsArray<SRC[P], DST[P], SCLR>;
    };

export type MapType<SRC, DST, SCLR extends ScalarDefinition> = SRC extends DeepAnify<DST>
  ? IsInterfaced<SRC, DST, SCLR>
  : never;
// eslint-disable-next-line @typescript-eslint/ban-types
export type InputType<SRC, DST, SCLR extends ScalarDefinition = {}> = IsPayLoad<DST> extends { __alias: infer R }
  ? {
      [P in keyof R]: MapType<SRC, R[P], SCLR>[keyof MapType<SRC, R[P], SCLR>];
    } & MapType<SRC, Omit<IsPayLoad<DST>, '__alias'>, SCLR>
  : MapType<SRC, IsPayLoad<DST>, SCLR>;
export type SubscriptionToGraphQL<Z, T, SCLR extends ScalarDefinition> = {
  ws: WebSocket;
  on: (fn: (args: InputType<T, Z, SCLR>) => void) => void;
  off: (fn: (e: { data?: InputType<T, Z, SCLR>; code?: number; reason?: string; message?: string }) => void) => void;
  error: (fn: (e: { data?: InputType<T, Z, SCLR>; errors?: string[] }) => void) => void;
  open: () => void;
};

// eslint-disable-next-line @typescript-eslint/ban-types
export type FromSelector<SELECTOR, NAME extends keyof GraphQLTypes, SCLR extends ScalarDefinition = {}> = InputType<
  GraphQLTypes[NAME],
  SELECTOR,
  SCLR
>;

export type ScalarResolver = {
  encode?: (s: unknown) => string;
  decode?: (s: unknown) => unknown;
};

export type SelectionFunction<V> = <T>(t: T | V) => T;

type BuiltInVariableTypes = {
  ['String']: string;
  ['Int']: number;
  ['Float']: number;
  ['ID']: unknown;
  ['Boolean']: boolean;
};
type AllVariableTypes = keyof BuiltInVariableTypes | keyof ZEUS_VARIABLES;
type VariableRequired<T extends string> = `${T}!` | T | `[${T}]` | `[${T}]!` | `[${T}!]` | `[${T}!]!`;
type VR<T extends string> = VariableRequired<VariableRequired<T>>;

export type GraphQLVariableType = VR<AllVariableTypes>;

type ExtractVariableTypeString<T extends string> = T extends VR<infer R1>
  ? R1 extends VR<infer R2>
    ? R2 extends VR<infer R3>
      ? R3 extends VR<infer R4>
        ? R4 extends VR<infer R5>
          ? R5
          : R4
        : R3
      : R2
    : R1
  : T;

type DecomposeType<T, Type> = T extends `[${infer R}]`
  ? Array<DecomposeType<R, Type>> | undefined
  : T extends `${infer R}!`
  ? NonNullable<DecomposeType<R, Type>>
  : Type | undefined;

type ExtractTypeFromGraphQLType<T extends string> = T extends keyof ZEUS_VARIABLES
  ? ZEUS_VARIABLES[T]
  : T extends keyof BuiltInVariableTypes
  ? BuiltInVariableTypes[T]
  : any;

export type GetVariableType<T extends string> = DecomposeType<
  T,
  ExtractTypeFromGraphQLType<ExtractVariableTypeString<T>>
>;

type UndefinedKeys<T> = {
  [K in keyof T]-?: T[K] extends NonNullable<T[K]> ? never : K;
}[keyof T];

type WithNullableKeys<T> = Pick<T, UndefinedKeys<T>>;
type WithNonNullableKeys<T> = Omit<T, UndefinedKeys<T>>;

type OptionalKeys<T> = {
  [P in keyof T]?: T[P];
};

export type WithOptionalNullables<T> = OptionalKeys<WithNullableKeys<T>> & WithNonNullableKeys<T>;

export type Variable<T extends GraphQLVariableType, Name extends string> = {
  ' __zeus_name': Name;
  ' __zeus_type': T;
};

export type ExtractVariables<Query> = Query extends Variable<infer VType, infer VName>
  ? { [key in VName]: GetVariableType<VType> }
  : Query extends [infer Inputs, infer Outputs]
  ? ExtractVariables<Inputs> & ExtractVariables<Outputs>
  : Query extends string | number | boolean
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    {}
  : UnionToIntersection<{ [K in keyof Query]: WithOptionalNullables<ExtractVariables<Query[K]>> }[keyof Query]>;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

export const START_VAR_NAME = `$ZEUS_VAR`;
export const GRAPHQL_TYPE_SEPARATOR = `__$GRAPHQL__`;

export const $ = <Type extends GraphQLVariableType, Name extends string>(name: Name, graphqlType: Type) => {
  return (START_VAR_NAME + name + GRAPHQL_TYPE_SEPARATOR + graphqlType) as unknown as Variable<Type, Name>;
};
type ZEUS_INTERFACES = never
export type ScalarCoders = {
	JSON?: ScalarResolver;
	DateTime?: ScalarResolver;
	Upload?: ScalarResolver;
}
type ZEUS_UNIONS = GraphQLTypes["GenericMorph"]

export type ValueTypes = {
    /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
["JSON"]:unknown;
	/** A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the `date-time` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar. */
["DateTime"]:unknown;
	/** The `Upload` scalar type represents a file upload. */
["Upload"]:unknown;
	["Pagination"]: AliasType<{
	total?:boolean | `@${string}`,
	page?:boolean | `@${string}`,
	pageSize?:boolean | `@${string}`,
	pageCount?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ResponseCollectionMeta"]: AliasType<{
	pagination?:ValueTypes["Pagination"],
		__typename?: boolean | `@${string}`
}>;
	["PublicationState"]:PublicationState;
	["IDFilterInput"]: {
	and?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	not?: ValueTypes["IDFilterInput"] | undefined | null | Variable<any, string>,
	eq?: string | undefined | null | Variable<any, string>,
	eqi?: string | undefined | null | Variable<any, string>,
	ne?: string | undefined | null | Variable<any, string>,
	startsWith?: string | undefined | null | Variable<any, string>,
	endsWith?: string | undefined | null | Variable<any, string>,
	contains?: string | undefined | null | Variable<any, string>,
	notContains?: string | undefined | null | Variable<any, string>,
	containsi?: string | undefined | null | Variable<any, string>,
	notContainsi?: string | undefined | null | Variable<any, string>,
	gt?: string | undefined | null | Variable<any, string>,
	gte?: string | undefined | null | Variable<any, string>,
	lt?: string | undefined | null | Variable<any, string>,
	lte?: string | undefined | null | Variable<any, string>,
	null?: boolean | undefined | null | Variable<any, string>,
	notNull?: boolean | undefined | null | Variable<any, string>,
	in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	notIn?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	between?: Array<string | undefined | null> | undefined | null | Variable<any, string>
};
	["BooleanFilterInput"]: {
	and?: Array<boolean | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<boolean | undefined | null> | undefined | null | Variable<any, string>,
	not?: ValueTypes["BooleanFilterInput"] | undefined | null | Variable<any, string>,
	eq?: boolean | undefined | null | Variable<any, string>,
	eqi?: boolean | undefined | null | Variable<any, string>,
	ne?: boolean | undefined | null | Variable<any, string>,
	startsWith?: boolean | undefined | null | Variable<any, string>,
	endsWith?: boolean | undefined | null | Variable<any, string>,
	contains?: boolean | undefined | null | Variable<any, string>,
	notContains?: boolean | undefined | null | Variable<any, string>,
	containsi?: boolean | undefined | null | Variable<any, string>,
	notContainsi?: boolean | undefined | null | Variable<any, string>,
	gt?: boolean | undefined | null | Variable<any, string>,
	gte?: boolean | undefined | null | Variable<any, string>,
	lt?: boolean | undefined | null | Variable<any, string>,
	lte?: boolean | undefined | null | Variable<any, string>,
	null?: boolean | undefined | null | Variable<any, string>,
	notNull?: boolean | undefined | null | Variable<any, string>,
	in?: Array<boolean | undefined | null> | undefined | null | Variable<any, string>,
	notIn?: Array<boolean | undefined | null> | undefined | null | Variable<any, string>,
	between?: Array<boolean | undefined | null> | undefined | null | Variable<any, string>
};
	["StringFilterInput"]: {
	and?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	not?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	eq?: string | undefined | null | Variable<any, string>,
	eqi?: string | undefined | null | Variable<any, string>,
	ne?: string | undefined | null | Variable<any, string>,
	startsWith?: string | undefined | null | Variable<any, string>,
	endsWith?: string | undefined | null | Variable<any, string>,
	contains?: string | undefined | null | Variable<any, string>,
	notContains?: string | undefined | null | Variable<any, string>,
	containsi?: string | undefined | null | Variable<any, string>,
	notContainsi?: string | undefined | null | Variable<any, string>,
	gt?: string | undefined | null | Variable<any, string>,
	gte?: string | undefined | null | Variable<any, string>,
	lt?: string | undefined | null | Variable<any, string>,
	lte?: string | undefined | null | Variable<any, string>,
	null?: boolean | undefined | null | Variable<any, string>,
	notNull?: boolean | undefined | null | Variable<any, string>,
	in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	notIn?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	between?: Array<string | undefined | null> | undefined | null | Variable<any, string>
};
	["IntFilterInput"]: {
	and?: Array<number | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<number | undefined | null> | undefined | null | Variable<any, string>,
	not?: ValueTypes["IntFilterInput"] | undefined | null | Variable<any, string>,
	eq?: number | undefined | null | Variable<any, string>,
	eqi?: number | undefined | null | Variable<any, string>,
	ne?: number | undefined | null | Variable<any, string>,
	startsWith?: number | undefined | null | Variable<any, string>,
	endsWith?: number | undefined | null | Variable<any, string>,
	contains?: number | undefined | null | Variable<any, string>,
	notContains?: number | undefined | null | Variable<any, string>,
	containsi?: number | undefined | null | Variable<any, string>,
	notContainsi?: number | undefined | null | Variable<any, string>,
	gt?: number | undefined | null | Variable<any, string>,
	gte?: number | undefined | null | Variable<any, string>,
	lt?: number | undefined | null | Variable<any, string>,
	lte?: number | undefined | null | Variable<any, string>,
	null?: boolean | undefined | null | Variable<any, string>,
	notNull?: boolean | undefined | null | Variable<any, string>,
	in?: Array<number | undefined | null> | undefined | null | Variable<any, string>,
	notIn?: Array<number | undefined | null> | undefined | null | Variable<any, string>,
	between?: Array<number | undefined | null> | undefined | null | Variable<any, string>
};
	["FloatFilterInput"]: {
	and?: Array<number | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<number | undefined | null> | undefined | null | Variable<any, string>,
	not?: ValueTypes["FloatFilterInput"] | undefined | null | Variable<any, string>,
	eq?: number | undefined | null | Variable<any, string>,
	eqi?: number | undefined | null | Variable<any, string>,
	ne?: number | undefined | null | Variable<any, string>,
	startsWith?: number | undefined | null | Variable<any, string>,
	endsWith?: number | undefined | null | Variable<any, string>,
	contains?: number | undefined | null | Variable<any, string>,
	notContains?: number | undefined | null | Variable<any, string>,
	containsi?: number | undefined | null | Variable<any, string>,
	notContainsi?: number | undefined | null | Variable<any, string>,
	gt?: number | undefined | null | Variable<any, string>,
	gte?: number | undefined | null | Variable<any, string>,
	lt?: number | undefined | null | Variable<any, string>,
	lte?: number | undefined | null | Variable<any, string>,
	null?: boolean | undefined | null | Variable<any, string>,
	notNull?: boolean | undefined | null | Variable<any, string>,
	in?: Array<number | undefined | null> | undefined | null | Variable<any, string>,
	notIn?: Array<number | undefined | null> | undefined | null | Variable<any, string>,
	between?: Array<number | undefined | null> | undefined | null | Variable<any, string>
};
	["DateTimeFilterInput"]: {
	and?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	not?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	eq?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	eqi?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	ne?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	startsWith?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	endsWith?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	contains?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	notContains?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	containsi?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	notContainsi?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	null?: boolean | undefined | null | Variable<any, string>,
	notNull?: boolean | undefined | null | Variable<any, string>,
	in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	notIn?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	between?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>
};
	["JSONFilterInput"]: {
	and?: Array<ValueTypes["JSON"] | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<ValueTypes["JSON"] | undefined | null> | undefined | null | Variable<any, string>,
	not?: ValueTypes["JSONFilterInput"] | undefined | null | Variable<any, string>,
	eq?: ValueTypes["JSON"] | undefined | null | Variable<any, string>,
	eqi?: ValueTypes["JSON"] | undefined | null | Variable<any, string>,
	ne?: ValueTypes["JSON"] | undefined | null | Variable<any, string>,
	startsWith?: ValueTypes["JSON"] | undefined | null | Variable<any, string>,
	endsWith?: ValueTypes["JSON"] | undefined | null | Variable<any, string>,
	contains?: ValueTypes["JSON"] | undefined | null | Variable<any, string>,
	notContains?: ValueTypes["JSON"] | undefined | null | Variable<any, string>,
	containsi?: ValueTypes["JSON"] | undefined | null | Variable<any, string>,
	notContainsi?: ValueTypes["JSON"] | undefined | null | Variable<any, string>,
	gt?: ValueTypes["JSON"] | undefined | null | Variable<any, string>,
	gte?: ValueTypes["JSON"] | undefined | null | Variable<any, string>,
	lt?: ValueTypes["JSON"] | undefined | null | Variable<any, string>,
	lte?: ValueTypes["JSON"] | undefined | null | Variable<any, string>,
	null?: boolean | undefined | null | Variable<any, string>,
	notNull?: boolean | undefined | null | Variable<any, string>,
	in?: Array<ValueTypes["JSON"] | undefined | null> | undefined | null | Variable<any, string>,
	notIn?: Array<ValueTypes["JSON"] | undefined | null> | undefined | null | Variable<any, string>,
	between?: Array<ValueTypes["JSON"] | undefined | null> | undefined | null | Variable<any, string>
};
	["UploadFileFiltersInput"]: {
	id?: ValueTypes["IDFilterInput"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	alternativeText?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	caption?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	width?: ValueTypes["IntFilterInput"] | undefined | null | Variable<any, string>,
	height?: ValueTypes["IntFilterInput"] | undefined | null | Variable<any, string>,
	formats?: ValueTypes["JSONFilterInput"] | undefined | null | Variable<any, string>,
	hash?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	ext?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	mime?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	size?: ValueTypes["FloatFilterInput"] | undefined | null | Variable<any, string>,
	url?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	previewUrl?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	provider?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	provider_metadata?: ValueTypes["JSONFilterInput"] | undefined | null | Variable<any, string>,
	folder?: ValueTypes["UploadFolderFiltersInput"] | undefined | null | Variable<any, string>,
	folderPath?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	and?: Array<ValueTypes["UploadFileFiltersInput"] | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<ValueTypes["UploadFileFiltersInput"] | undefined | null> | undefined | null | Variable<any, string>,
	not?: ValueTypes["UploadFileFiltersInput"] | undefined | null | Variable<any, string>
};
	["UploadFileInput"]: {
	name?: string | undefined | null | Variable<any, string>,
	alternativeText?: string | undefined | null | Variable<any, string>,
	caption?: string | undefined | null | Variable<any, string>,
	width?: number | undefined | null | Variable<any, string>,
	height?: number | undefined | null | Variable<any, string>,
	formats?: ValueTypes["JSON"] | undefined | null | Variable<any, string>,
	hash?: string | undefined | null | Variable<any, string>,
	ext?: string | undefined | null | Variable<any, string>,
	mime?: string | undefined | null | Variable<any, string>,
	size?: number | undefined | null | Variable<any, string>,
	url?: string | undefined | null | Variable<any, string>,
	previewUrl?: string | undefined | null | Variable<any, string>,
	provider?: string | undefined | null | Variable<any, string>,
	provider_metadata?: ValueTypes["JSON"] | undefined | null | Variable<any, string>,
	folder?: string | undefined | null | Variable<any, string>,
	folderPath?: string | undefined | null | Variable<any, string>
};
	["UploadFile"]: AliasType<{
	name?:boolean | `@${string}`,
	alternativeText?:boolean | `@${string}`,
	caption?:boolean | `@${string}`,
	width?:boolean | `@${string}`,
	height?:boolean | `@${string}`,
	formats?:boolean | `@${string}`,
	hash?:boolean | `@${string}`,
	ext?:boolean | `@${string}`,
	mime?:boolean | `@${string}`,
	size?:boolean | `@${string}`,
	url?:boolean | `@${string}`,
	previewUrl?:boolean | `@${string}`,
	provider?:boolean | `@${string}`,
	provider_metadata?:boolean | `@${string}`,
	related?:ValueTypes["GenericMorph"],
	createdAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UploadFileEntity"]: AliasType<{
	id?:boolean | `@${string}`,
	attributes?:ValueTypes["UploadFile"],
		__typename?: boolean | `@${string}`
}>;
	["UploadFileEntityResponse"]: AliasType<{
	data?:ValueTypes["UploadFileEntity"],
		__typename?: boolean | `@${string}`
}>;
	["UploadFileEntityResponseCollection"]: AliasType<{
	data?:ValueTypes["UploadFileEntity"],
	meta?:ValueTypes["ResponseCollectionMeta"],
		__typename?: boolean | `@${string}`
}>;
	["UploadFileRelationResponseCollection"]: AliasType<{
	data?:ValueTypes["UploadFileEntity"],
		__typename?: boolean | `@${string}`
}>;
	["UploadFolderFiltersInput"]: {
	id?: ValueTypes["IDFilterInput"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	pathId?: ValueTypes["IntFilterInput"] | undefined | null | Variable<any, string>,
	parent?: ValueTypes["UploadFolderFiltersInput"] | undefined | null | Variable<any, string>,
	children?: ValueTypes["UploadFolderFiltersInput"] | undefined | null | Variable<any, string>,
	files?: ValueTypes["UploadFileFiltersInput"] | undefined | null | Variable<any, string>,
	path?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	and?: Array<ValueTypes["UploadFolderFiltersInput"] | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<ValueTypes["UploadFolderFiltersInput"] | undefined | null> | undefined | null | Variable<any, string>,
	not?: ValueTypes["UploadFolderFiltersInput"] | undefined | null | Variable<any, string>
};
	["UploadFolderInput"]: {
	name?: string | undefined | null | Variable<any, string>,
	pathId?: number | undefined | null | Variable<any, string>,
	parent?: string | undefined | null | Variable<any, string>,
	children?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	files?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	path?: string | undefined | null | Variable<any, string>
};
	["UploadFolder"]: AliasType<{
	name?:boolean | `@${string}`,
	pathId?:boolean | `@${string}`,
	parent?:ValueTypes["UploadFolderEntityResponse"],
children?: [{	filters?: ValueTypes["UploadFolderFiltersInput"] | undefined | null | Variable<any, string>,	pagination?: ValueTypes["PaginationArg"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>},ValueTypes["UploadFolderRelationResponseCollection"]],
files?: [{	filters?: ValueTypes["UploadFileFiltersInput"] | undefined | null | Variable<any, string>,	pagination?: ValueTypes["PaginationArg"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>},ValueTypes["UploadFileRelationResponseCollection"]],
	path?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UploadFolderEntity"]: AliasType<{
	id?:boolean | `@${string}`,
	attributes?:ValueTypes["UploadFolder"],
		__typename?: boolean | `@${string}`
}>;
	["UploadFolderEntityResponse"]: AliasType<{
	data?:ValueTypes["UploadFolderEntity"],
		__typename?: boolean | `@${string}`
}>;
	["UploadFolderEntityResponseCollection"]: AliasType<{
	data?:ValueTypes["UploadFolderEntity"],
	meta?:ValueTypes["ResponseCollectionMeta"],
		__typename?: boolean | `@${string}`
}>;
	["UploadFolderRelationResponseCollection"]: AliasType<{
	data?:ValueTypes["UploadFolderEntity"],
		__typename?: boolean | `@${string}`
}>;
	["I18NLocaleFiltersInput"]: {
	id?: ValueTypes["IDFilterInput"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	code?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	and?: Array<ValueTypes["I18NLocaleFiltersInput"] | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<ValueTypes["I18NLocaleFiltersInput"] | undefined | null> | undefined | null | Variable<any, string>,
	not?: ValueTypes["I18NLocaleFiltersInput"] | undefined | null | Variable<any, string>
};
	["I18NLocale"]: AliasType<{
	name?:boolean | `@${string}`,
	code?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["I18NLocaleEntity"]: AliasType<{
	id?:boolean | `@${string}`,
	attributes?:ValueTypes["I18NLocale"],
		__typename?: boolean | `@${string}`
}>;
	["I18NLocaleEntityResponse"]: AliasType<{
	data?:ValueTypes["I18NLocaleEntity"],
		__typename?: boolean | `@${string}`
}>;
	["I18NLocaleEntityResponseCollection"]: AliasType<{
	data?:ValueTypes["I18NLocaleEntity"],
	meta?:ValueTypes["ResponseCollectionMeta"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsPermissionFiltersInput"]: {
	id?: ValueTypes["IDFilterInput"] | undefined | null | Variable<any, string>,
	action?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	role?: ValueTypes["UsersPermissionsRoleFiltersInput"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	and?: Array<ValueTypes["UsersPermissionsPermissionFiltersInput"] | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<ValueTypes["UsersPermissionsPermissionFiltersInput"] | undefined | null> | undefined | null | Variable<any, string>,
	not?: ValueTypes["UsersPermissionsPermissionFiltersInput"] | undefined | null | Variable<any, string>
};
	["UsersPermissionsPermission"]: AliasType<{
	action?:boolean | `@${string}`,
	role?:ValueTypes["UsersPermissionsRoleEntityResponse"],
	createdAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsPermissionEntity"]: AliasType<{
	id?:boolean | `@${string}`,
	attributes?:ValueTypes["UsersPermissionsPermission"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsPermissionRelationResponseCollection"]: AliasType<{
	data?:ValueTypes["UsersPermissionsPermissionEntity"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsRoleFiltersInput"]: {
	id?: ValueTypes["IDFilterInput"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	description?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	permissions?: ValueTypes["UsersPermissionsPermissionFiltersInput"] | undefined | null | Variable<any, string>,
	users?: ValueTypes["UsersPermissionsUserFiltersInput"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	and?: Array<ValueTypes["UsersPermissionsRoleFiltersInput"] | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<ValueTypes["UsersPermissionsRoleFiltersInput"] | undefined | null> | undefined | null | Variable<any, string>,
	not?: ValueTypes["UsersPermissionsRoleFiltersInput"] | undefined | null | Variable<any, string>
};
	["UsersPermissionsRoleInput"]: {
	name?: string | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	permissions?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	users?: Array<string | undefined | null> | undefined | null | Variable<any, string>
};
	["UsersPermissionsRole"]: AliasType<{
	name?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
permissions?: [{	filters?: ValueTypes["UsersPermissionsPermissionFiltersInput"] | undefined | null | Variable<any, string>,	pagination?: ValueTypes["PaginationArg"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>},ValueTypes["UsersPermissionsPermissionRelationResponseCollection"]],
users?: [{	filters?: ValueTypes["UsersPermissionsUserFiltersInput"] | undefined | null | Variable<any, string>,	pagination?: ValueTypes["PaginationArg"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>},ValueTypes["UsersPermissionsUserRelationResponseCollection"]],
	createdAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsRoleEntity"]: AliasType<{
	id?:boolean | `@${string}`,
	attributes?:ValueTypes["UsersPermissionsRole"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsRoleEntityResponse"]: AliasType<{
	data?:ValueTypes["UsersPermissionsRoleEntity"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsRoleEntityResponseCollection"]: AliasType<{
	data?:ValueTypes["UsersPermissionsRoleEntity"],
	meta?:ValueTypes["ResponseCollectionMeta"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsUserFiltersInput"]: {
	id?: ValueTypes["IDFilterInput"] | undefined | null | Variable<any, string>,
	username?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	email?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	provider?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	password?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	resetPasswordToken?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	confirmationToken?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	confirmed?: ValueTypes["BooleanFilterInput"] | undefined | null | Variable<any, string>,
	blocked?: ValueTypes["BooleanFilterInput"] | undefined | null | Variable<any, string>,
	role?: ValueTypes["UsersPermissionsRoleFiltersInput"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	and?: Array<ValueTypes["UsersPermissionsUserFiltersInput"] | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<ValueTypes["UsersPermissionsUserFiltersInput"] | undefined | null> | undefined | null | Variable<any, string>,
	not?: ValueTypes["UsersPermissionsUserFiltersInput"] | undefined | null | Variable<any, string>
};
	["UsersPermissionsUserInput"]: {
	username?: string | undefined | null | Variable<any, string>,
	email?: string | undefined | null | Variable<any, string>,
	provider?: string | undefined | null | Variable<any, string>,
	password?: string | undefined | null | Variable<any, string>,
	resetPasswordToken?: string | undefined | null | Variable<any, string>,
	confirmationToken?: string | undefined | null | Variable<any, string>,
	confirmed?: boolean | undefined | null | Variable<any, string>,
	blocked?: boolean | undefined | null | Variable<any, string>,
	role?: string | undefined | null | Variable<any, string>
};
	["UsersPermissionsUser"]: AliasType<{
	username?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	provider?:boolean | `@${string}`,
	confirmed?:boolean | `@${string}`,
	blocked?:boolean | `@${string}`,
	role?:ValueTypes["UsersPermissionsRoleEntityResponse"],
	createdAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsUserEntity"]: AliasType<{
	id?:boolean | `@${string}`,
	attributes?:ValueTypes["UsersPermissionsUser"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsUserEntityResponse"]: AliasType<{
	data?:ValueTypes["UsersPermissionsUserEntity"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsUserEntityResponseCollection"]: AliasType<{
	data?:ValueTypes["UsersPermissionsUserEntity"],
	meta?:ValueTypes["ResponseCollectionMeta"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsUserRelationResponseCollection"]: AliasType<{
	data?:ValueTypes["UsersPermissionsUserEntity"],
		__typename?: boolean | `@${string}`
}>;
	["MunicipalityFiltersInput"]: {
	id?: ValueTypes["IDFilterInput"] | undefined | null | Variable<any, string>,
	Title?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	and?: Array<ValueTypes["MunicipalityFiltersInput"] | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<ValueTypes["MunicipalityFiltersInput"] | undefined | null> | undefined | null | Variable<any, string>,
	not?: ValueTypes["MunicipalityFiltersInput"] | undefined | null | Variable<any, string>
};
	["MunicipalityInput"]: {
	Title?: string | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>
};
	["Municipality"]: AliasType<{
	Title?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	publishedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["MunicipalityEntity"]: AliasType<{
	id?:boolean | `@${string}`,
	attributes?:ValueTypes["Municipality"],
		__typename?: boolean | `@${string}`
}>;
	["MunicipalityEntityResponse"]: AliasType<{
	data?:ValueTypes["MunicipalityEntity"],
		__typename?: boolean | `@${string}`
}>;
	["MunicipalityEntityResponseCollection"]: AliasType<{
	data?:ValueTypes["MunicipalityEntity"],
	meta?:ValueTypes["ResponseCollectionMeta"],
		__typename?: boolean | `@${string}`
}>;
	["MunicipalityRelationResponseCollection"]: AliasType<{
	data?:ValueTypes["MunicipalityEntity"],
		__typename?: boolean | `@${string}`
}>;
	["ProviderFiltersInput"]: {
	id?: ValueTypes["IDFilterInput"] | undefined | null | Variable<any, string>,
	Title?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	services?: ValueTypes["ServiceFiltersInput"] | undefined | null | Variable<any, string>,
	municipalities?: ValueTypes["MunicipalityFiltersInput"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	and?: Array<ValueTypes["ProviderFiltersInput"] | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<ValueTypes["ProviderFiltersInput"] | undefined | null> | undefined | null | Variable<any, string>,
	not?: ValueTypes["ProviderFiltersInput"] | undefined | null | Variable<any, string>
};
	["ProviderInput"]: {
	Title?: string | undefined | null | Variable<any, string>,
	services?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	municipalities?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	logo?: string | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>
};
	["Provider"]: AliasType<{
	Title?:boolean | `@${string}`,
services?: [{	filters?: ValueTypes["ServiceFiltersInput"] | undefined | null | Variable<any, string>,	pagination?: ValueTypes["PaginationArg"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>,	publicationState?: ValueTypes["PublicationState"] | undefined | null | Variable<any, string>},ValueTypes["ServiceRelationResponseCollection"]],
municipalities?: [{	filters?: ValueTypes["MunicipalityFiltersInput"] | undefined | null | Variable<any, string>,	pagination?: ValueTypes["PaginationArg"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>,	publicationState?: ValueTypes["PublicationState"] | undefined | null | Variable<any, string>},ValueTypes["MunicipalityRelationResponseCollection"]],
	logo?:ValueTypes["UploadFileEntityResponse"],
	createdAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	publishedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ProviderEntity"]: AliasType<{
	id?:boolean | `@${string}`,
	attributes?:ValueTypes["Provider"],
		__typename?: boolean | `@${string}`
}>;
	["ProviderEntityResponse"]: AliasType<{
	data?:ValueTypes["ProviderEntity"],
		__typename?: boolean | `@${string}`
}>;
	["ProviderEntityResponseCollection"]: AliasType<{
	data?:ValueTypes["ProviderEntity"],
	meta?:ValueTypes["ResponseCollectionMeta"],
		__typename?: boolean | `@${string}`
}>;
	["ServiceFiltersInput"]: {
	id?: ValueTypes["IDFilterInput"] | undefined | null | Variable<any, string>,
	Title?: ValueTypes["StringFilterInput"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTimeFilterInput"] | undefined | null | Variable<any, string>,
	and?: Array<ValueTypes["ServiceFiltersInput"] | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<ValueTypes["ServiceFiltersInput"] | undefined | null> | undefined | null | Variable<any, string>,
	not?: ValueTypes["ServiceFiltersInput"] | undefined | null | Variable<any, string>
};
	["ServiceInput"]: {
	Title?: string | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>
};
	["Service"]: AliasType<{
	Title?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	publishedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ServiceEntity"]: AliasType<{
	id?:boolean | `@${string}`,
	attributes?:ValueTypes["Service"],
		__typename?: boolean | `@${string}`
}>;
	["ServiceEntityResponse"]: AliasType<{
	data?:ValueTypes["ServiceEntity"],
		__typename?: boolean | `@${string}`
}>;
	["ServiceEntityResponseCollection"]: AliasType<{
	data?:ValueTypes["ServiceEntity"],
	meta?:ValueTypes["ResponseCollectionMeta"],
		__typename?: boolean | `@${string}`
}>;
	["ServiceRelationResponseCollection"]: AliasType<{
	data?:ValueTypes["ServiceEntity"],
		__typename?: boolean | `@${string}`
}>;
	["GenericMorph"]: AliasType<{		["...on UploadFile"] : ValueTypes["UploadFile"],
		["...on UploadFolder"] : ValueTypes["UploadFolder"],
		["...on I18NLocale"] : ValueTypes["I18NLocale"],
		["...on UsersPermissionsPermission"] : ValueTypes["UsersPermissionsPermission"],
		["...on UsersPermissionsRole"] : ValueTypes["UsersPermissionsRole"],
		["...on UsersPermissionsUser"] : ValueTypes["UsersPermissionsUser"],
		["...on Municipality"] : ValueTypes["Municipality"],
		["...on Provider"] : ValueTypes["Provider"],
		["...on Service"] : ValueTypes["Service"]
		__typename?: boolean | `@${string}`
}>;
	["FileInfoInput"]: {
	name?: string | undefined | null | Variable<any, string>,
	alternativeText?: string | undefined | null | Variable<any, string>,
	caption?: string | undefined | null | Variable<any, string>
};
	["UsersPermissionsMe"]: AliasType<{
	id?:boolean | `@${string}`,
	username?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	confirmed?:boolean | `@${string}`,
	blocked?:boolean | `@${string}`,
	role?:ValueTypes["UsersPermissionsMeRole"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsMeRole"]: AliasType<{
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsRegisterInput"]: {
	username: string | Variable<any, string>,
	email: string | Variable<any, string>,
	password: string | Variable<any, string>
};
	["UsersPermissionsLoginInput"]: {
	identifier: string | Variable<any, string>,
	password: string | Variable<any, string>,
	provider: string | Variable<any, string>
};
	["UsersPermissionsPasswordPayload"]: AliasType<{
	ok?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsLoginPayload"]: AliasType<{
	jwt?:boolean | `@${string}`,
	user?:ValueTypes["UsersPermissionsMe"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsCreateRolePayload"]: AliasType<{
	ok?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsUpdateRolePayload"]: AliasType<{
	ok?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsDeleteRolePayload"]: AliasType<{
	ok?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["PaginationArg"]: {
	page?: number | undefined | null | Variable<any, string>,
	pageSize?: number | undefined | null | Variable<any, string>,
	start?: number | undefined | null | Variable<any, string>,
	limit?: number | undefined | null | Variable<any, string>
};
	["Query"]: AliasType<{
uploadFile?: [{	id?: string | undefined | null | Variable<any, string>},ValueTypes["UploadFileEntityResponse"]],
uploadFiles?: [{	filters?: ValueTypes["UploadFileFiltersInput"] | undefined | null | Variable<any, string>,	pagination?: ValueTypes["PaginationArg"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>},ValueTypes["UploadFileEntityResponseCollection"]],
uploadFolder?: [{	id?: string | undefined | null | Variable<any, string>},ValueTypes["UploadFolderEntityResponse"]],
uploadFolders?: [{	filters?: ValueTypes["UploadFolderFiltersInput"] | undefined | null | Variable<any, string>,	pagination?: ValueTypes["PaginationArg"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>},ValueTypes["UploadFolderEntityResponseCollection"]],
i18NLocale?: [{	id?: string | undefined | null | Variable<any, string>},ValueTypes["I18NLocaleEntityResponse"]],
i18NLocales?: [{	filters?: ValueTypes["I18NLocaleFiltersInput"] | undefined | null | Variable<any, string>,	pagination?: ValueTypes["PaginationArg"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>},ValueTypes["I18NLocaleEntityResponseCollection"]],
usersPermissionsRole?: [{	id?: string | undefined | null | Variable<any, string>},ValueTypes["UsersPermissionsRoleEntityResponse"]],
usersPermissionsRoles?: [{	filters?: ValueTypes["UsersPermissionsRoleFiltersInput"] | undefined | null | Variable<any, string>,	pagination?: ValueTypes["PaginationArg"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>},ValueTypes["UsersPermissionsRoleEntityResponseCollection"]],
usersPermissionsUser?: [{	id?: string | undefined | null | Variable<any, string>},ValueTypes["UsersPermissionsUserEntityResponse"]],
usersPermissionsUsers?: [{	filters?: ValueTypes["UsersPermissionsUserFiltersInput"] | undefined | null | Variable<any, string>,	pagination?: ValueTypes["PaginationArg"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>},ValueTypes["UsersPermissionsUserEntityResponseCollection"]],
municipality?: [{	id?: string | undefined | null | Variable<any, string>},ValueTypes["MunicipalityEntityResponse"]],
municipalities?: [{	filters?: ValueTypes["MunicipalityFiltersInput"] | undefined | null | Variable<any, string>,	pagination?: ValueTypes["PaginationArg"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>,	publicationState?: ValueTypes["PublicationState"] | undefined | null | Variable<any, string>},ValueTypes["MunicipalityEntityResponseCollection"]],
provider?: [{	id?: string | undefined | null | Variable<any, string>},ValueTypes["ProviderEntityResponse"]],
providers?: [{	filters?: ValueTypes["ProviderFiltersInput"] | undefined | null | Variable<any, string>,	pagination?: ValueTypes["PaginationArg"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>,	publicationState?: ValueTypes["PublicationState"] | undefined | null | Variable<any, string>},ValueTypes["ProviderEntityResponseCollection"]],
service?: [{	id?: string | undefined | null | Variable<any, string>},ValueTypes["ServiceEntityResponse"]],
services?: [{	filters?: ValueTypes["ServiceFiltersInput"] | undefined | null | Variable<any, string>,	pagination?: ValueTypes["PaginationArg"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>,	publicationState?: ValueTypes["PublicationState"] | undefined | null | Variable<any, string>},ValueTypes["ServiceEntityResponseCollection"]],
	me?:ValueTypes["UsersPermissionsMe"],
		__typename?: boolean | `@${string}`
}>;
	["Mutation"]: AliasType<{
createUploadFile?: [{	data: ValueTypes["UploadFileInput"] | Variable<any, string>},ValueTypes["UploadFileEntityResponse"]],
updateUploadFile?: [{	id: string | Variable<any, string>,	data: ValueTypes["UploadFileInput"] | Variable<any, string>},ValueTypes["UploadFileEntityResponse"]],
deleteUploadFile?: [{	id: string | Variable<any, string>},ValueTypes["UploadFileEntityResponse"]],
createUploadFolder?: [{	data: ValueTypes["UploadFolderInput"] | Variable<any, string>},ValueTypes["UploadFolderEntityResponse"]],
updateUploadFolder?: [{	id: string | Variable<any, string>,	data: ValueTypes["UploadFolderInput"] | Variable<any, string>},ValueTypes["UploadFolderEntityResponse"]],
deleteUploadFolder?: [{	id: string | Variable<any, string>},ValueTypes["UploadFolderEntityResponse"]],
createMunicipality?: [{	data: ValueTypes["MunicipalityInput"] | Variable<any, string>},ValueTypes["MunicipalityEntityResponse"]],
updateMunicipality?: [{	id: string | Variable<any, string>,	data: ValueTypes["MunicipalityInput"] | Variable<any, string>},ValueTypes["MunicipalityEntityResponse"]],
deleteMunicipality?: [{	id: string | Variable<any, string>},ValueTypes["MunicipalityEntityResponse"]],
createProvider?: [{	data: ValueTypes["ProviderInput"] | Variable<any, string>},ValueTypes["ProviderEntityResponse"]],
updateProvider?: [{	id: string | Variable<any, string>,	data: ValueTypes["ProviderInput"] | Variable<any, string>},ValueTypes["ProviderEntityResponse"]],
deleteProvider?: [{	id: string | Variable<any, string>},ValueTypes["ProviderEntityResponse"]],
createService?: [{	data: ValueTypes["ServiceInput"] | Variable<any, string>},ValueTypes["ServiceEntityResponse"]],
updateService?: [{	id: string | Variable<any, string>,	data: ValueTypes["ServiceInput"] | Variable<any, string>},ValueTypes["ServiceEntityResponse"]],
deleteService?: [{	id: string | Variable<any, string>},ValueTypes["ServiceEntityResponse"]],
upload?: [{	refId?: string | undefined | null | Variable<any, string>,	ref?: string | undefined | null | Variable<any, string>,	field?: string | undefined | null | Variable<any, string>,	info?: ValueTypes["FileInfoInput"] | undefined | null | Variable<any, string>,	file: ValueTypes["Upload"] | Variable<any, string>},ValueTypes["UploadFileEntityResponse"]],
multipleUpload?: [{	refId?: string | undefined | null | Variable<any, string>,	ref?: string | undefined | null | Variable<any, string>,	field?: string | undefined | null | Variable<any, string>,	files: Array<ValueTypes["Upload"] | undefined | null> | Variable<any, string>},ValueTypes["UploadFileEntityResponse"]],
updateFileInfo?: [{	id: string | Variable<any, string>,	info?: ValueTypes["FileInfoInput"] | undefined | null | Variable<any, string>},ValueTypes["UploadFileEntityResponse"]],
removeFile?: [{	id: string | Variable<any, string>},ValueTypes["UploadFileEntityResponse"]],
createUsersPermissionsRole?: [{	data: ValueTypes["UsersPermissionsRoleInput"] | Variable<any, string>},ValueTypes["UsersPermissionsCreateRolePayload"]],
updateUsersPermissionsRole?: [{	id: string | Variable<any, string>,	data: ValueTypes["UsersPermissionsRoleInput"] | Variable<any, string>},ValueTypes["UsersPermissionsUpdateRolePayload"]],
deleteUsersPermissionsRole?: [{	id: string | Variable<any, string>},ValueTypes["UsersPermissionsDeleteRolePayload"]],
createUsersPermissionsUser?: [{	data: ValueTypes["UsersPermissionsUserInput"] | Variable<any, string>},ValueTypes["UsersPermissionsUserEntityResponse"]],
updateUsersPermissionsUser?: [{	id: string | Variable<any, string>,	data: ValueTypes["UsersPermissionsUserInput"] | Variable<any, string>},ValueTypes["UsersPermissionsUserEntityResponse"]],
deleteUsersPermissionsUser?: [{	id: string | Variable<any, string>},ValueTypes["UsersPermissionsUserEntityResponse"]],
login?: [{	input: ValueTypes["UsersPermissionsLoginInput"] | Variable<any, string>},ValueTypes["UsersPermissionsLoginPayload"]],
register?: [{	input: ValueTypes["UsersPermissionsRegisterInput"] | Variable<any, string>},ValueTypes["UsersPermissionsLoginPayload"]],
forgotPassword?: [{	email: string | Variable<any, string>},ValueTypes["UsersPermissionsPasswordPayload"]],
resetPassword?: [{	password: string | Variable<any, string>,	passwordConfirmation: string | Variable<any, string>,	code: string | Variable<any, string>},ValueTypes["UsersPermissionsLoginPayload"]],
changePassword?: [{	currentPassword: string | Variable<any, string>,	password: string | Variable<any, string>,	passwordConfirmation: string | Variable<any, string>},ValueTypes["UsersPermissionsLoginPayload"]],
emailConfirmation?: [{	confirmation: string | Variable<any, string>},ValueTypes["UsersPermissionsLoginPayload"]],
		__typename?: boolean | `@${string}`
}>
  }

export type ResolverInputTypes = {
    /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
["JSON"]:unknown;
	/** A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the `date-time` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar. */
["DateTime"]:unknown;
	/** The `Upload` scalar type represents a file upload. */
["Upload"]:unknown;
	["Pagination"]: AliasType<{
	total?:boolean | `@${string}`,
	page?:boolean | `@${string}`,
	pageSize?:boolean | `@${string}`,
	pageCount?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ResponseCollectionMeta"]: AliasType<{
	pagination?:ResolverInputTypes["Pagination"],
		__typename?: boolean | `@${string}`
}>;
	["PublicationState"]:PublicationState;
	["IDFilterInput"]: {
	and?: Array<string | undefined | null> | undefined | null,
	or?: Array<string | undefined | null> | undefined | null,
	not?: ResolverInputTypes["IDFilterInput"] | undefined | null,
	eq?: string | undefined | null,
	eqi?: string | undefined | null,
	ne?: string | undefined | null,
	startsWith?: string | undefined | null,
	endsWith?: string | undefined | null,
	contains?: string | undefined | null,
	notContains?: string | undefined | null,
	containsi?: string | undefined | null,
	notContainsi?: string | undefined | null,
	gt?: string | undefined | null,
	gte?: string | undefined | null,
	lt?: string | undefined | null,
	lte?: string | undefined | null,
	null?: boolean | undefined | null,
	notNull?: boolean | undefined | null,
	in?: Array<string | undefined | null> | undefined | null,
	notIn?: Array<string | undefined | null> | undefined | null,
	between?: Array<string | undefined | null> | undefined | null
};
	["BooleanFilterInput"]: {
	and?: Array<boolean | undefined | null> | undefined | null,
	or?: Array<boolean | undefined | null> | undefined | null,
	not?: ResolverInputTypes["BooleanFilterInput"] | undefined | null,
	eq?: boolean | undefined | null,
	eqi?: boolean | undefined | null,
	ne?: boolean | undefined | null,
	startsWith?: boolean | undefined | null,
	endsWith?: boolean | undefined | null,
	contains?: boolean | undefined | null,
	notContains?: boolean | undefined | null,
	containsi?: boolean | undefined | null,
	notContainsi?: boolean | undefined | null,
	gt?: boolean | undefined | null,
	gte?: boolean | undefined | null,
	lt?: boolean | undefined | null,
	lte?: boolean | undefined | null,
	null?: boolean | undefined | null,
	notNull?: boolean | undefined | null,
	in?: Array<boolean | undefined | null> | undefined | null,
	notIn?: Array<boolean | undefined | null> | undefined | null,
	between?: Array<boolean | undefined | null> | undefined | null
};
	["StringFilterInput"]: {
	and?: Array<string | undefined | null> | undefined | null,
	or?: Array<string | undefined | null> | undefined | null,
	not?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	eq?: string | undefined | null,
	eqi?: string | undefined | null,
	ne?: string | undefined | null,
	startsWith?: string | undefined | null,
	endsWith?: string | undefined | null,
	contains?: string | undefined | null,
	notContains?: string | undefined | null,
	containsi?: string | undefined | null,
	notContainsi?: string | undefined | null,
	gt?: string | undefined | null,
	gte?: string | undefined | null,
	lt?: string | undefined | null,
	lte?: string | undefined | null,
	null?: boolean | undefined | null,
	notNull?: boolean | undefined | null,
	in?: Array<string | undefined | null> | undefined | null,
	notIn?: Array<string | undefined | null> | undefined | null,
	between?: Array<string | undefined | null> | undefined | null
};
	["IntFilterInput"]: {
	and?: Array<number | undefined | null> | undefined | null,
	or?: Array<number | undefined | null> | undefined | null,
	not?: ResolverInputTypes["IntFilterInput"] | undefined | null,
	eq?: number | undefined | null,
	eqi?: number | undefined | null,
	ne?: number | undefined | null,
	startsWith?: number | undefined | null,
	endsWith?: number | undefined | null,
	contains?: number | undefined | null,
	notContains?: number | undefined | null,
	containsi?: number | undefined | null,
	notContainsi?: number | undefined | null,
	gt?: number | undefined | null,
	gte?: number | undefined | null,
	lt?: number | undefined | null,
	lte?: number | undefined | null,
	null?: boolean | undefined | null,
	notNull?: boolean | undefined | null,
	in?: Array<number | undefined | null> | undefined | null,
	notIn?: Array<number | undefined | null> | undefined | null,
	between?: Array<number | undefined | null> | undefined | null
};
	["FloatFilterInput"]: {
	and?: Array<number | undefined | null> | undefined | null,
	or?: Array<number | undefined | null> | undefined | null,
	not?: ResolverInputTypes["FloatFilterInput"] | undefined | null,
	eq?: number | undefined | null,
	eqi?: number | undefined | null,
	ne?: number | undefined | null,
	startsWith?: number | undefined | null,
	endsWith?: number | undefined | null,
	contains?: number | undefined | null,
	notContains?: number | undefined | null,
	containsi?: number | undefined | null,
	notContainsi?: number | undefined | null,
	gt?: number | undefined | null,
	gte?: number | undefined | null,
	lt?: number | undefined | null,
	lte?: number | undefined | null,
	null?: boolean | undefined | null,
	notNull?: boolean | undefined | null,
	in?: Array<number | undefined | null> | undefined | null,
	notIn?: Array<number | undefined | null> | undefined | null,
	between?: Array<number | undefined | null> | undefined | null
};
	["DateTimeFilterInput"]: {
	and?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	or?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	not?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	eq?: ResolverInputTypes["DateTime"] | undefined | null,
	eqi?: ResolverInputTypes["DateTime"] | undefined | null,
	ne?: ResolverInputTypes["DateTime"] | undefined | null,
	startsWith?: ResolverInputTypes["DateTime"] | undefined | null,
	endsWith?: ResolverInputTypes["DateTime"] | undefined | null,
	contains?: ResolverInputTypes["DateTime"] | undefined | null,
	notContains?: ResolverInputTypes["DateTime"] | undefined | null,
	containsi?: ResolverInputTypes["DateTime"] | undefined | null,
	notContainsi?: ResolverInputTypes["DateTime"] | undefined | null,
	gt?: ResolverInputTypes["DateTime"] | undefined | null,
	gte?: ResolverInputTypes["DateTime"] | undefined | null,
	lt?: ResolverInputTypes["DateTime"] | undefined | null,
	lte?: ResolverInputTypes["DateTime"] | undefined | null,
	null?: boolean | undefined | null,
	notNull?: boolean | undefined | null,
	in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	notIn?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	between?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null
};
	["JSONFilterInput"]: {
	and?: Array<ResolverInputTypes["JSON"] | undefined | null> | undefined | null,
	or?: Array<ResolverInputTypes["JSON"] | undefined | null> | undefined | null,
	not?: ResolverInputTypes["JSONFilterInput"] | undefined | null,
	eq?: ResolverInputTypes["JSON"] | undefined | null,
	eqi?: ResolverInputTypes["JSON"] | undefined | null,
	ne?: ResolverInputTypes["JSON"] | undefined | null,
	startsWith?: ResolverInputTypes["JSON"] | undefined | null,
	endsWith?: ResolverInputTypes["JSON"] | undefined | null,
	contains?: ResolverInputTypes["JSON"] | undefined | null,
	notContains?: ResolverInputTypes["JSON"] | undefined | null,
	containsi?: ResolverInputTypes["JSON"] | undefined | null,
	notContainsi?: ResolverInputTypes["JSON"] | undefined | null,
	gt?: ResolverInputTypes["JSON"] | undefined | null,
	gte?: ResolverInputTypes["JSON"] | undefined | null,
	lt?: ResolverInputTypes["JSON"] | undefined | null,
	lte?: ResolverInputTypes["JSON"] | undefined | null,
	null?: boolean | undefined | null,
	notNull?: boolean | undefined | null,
	in?: Array<ResolverInputTypes["JSON"] | undefined | null> | undefined | null,
	notIn?: Array<ResolverInputTypes["JSON"] | undefined | null> | undefined | null,
	between?: Array<ResolverInputTypes["JSON"] | undefined | null> | undefined | null
};
	["UploadFileFiltersInput"]: {
	id?: ResolverInputTypes["IDFilterInput"] | undefined | null,
	name?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	alternativeText?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	caption?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	width?: ResolverInputTypes["IntFilterInput"] | undefined | null,
	height?: ResolverInputTypes["IntFilterInput"] | undefined | null,
	formats?: ResolverInputTypes["JSONFilterInput"] | undefined | null,
	hash?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	ext?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	mime?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	size?: ResolverInputTypes["FloatFilterInput"] | undefined | null,
	url?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	previewUrl?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	provider?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	provider_metadata?: ResolverInputTypes["JSONFilterInput"] | undefined | null,
	folder?: ResolverInputTypes["UploadFolderFiltersInput"] | undefined | null,
	folderPath?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	and?: Array<ResolverInputTypes["UploadFileFiltersInput"] | undefined | null> | undefined | null,
	or?: Array<ResolverInputTypes["UploadFileFiltersInput"] | undefined | null> | undefined | null,
	not?: ResolverInputTypes["UploadFileFiltersInput"] | undefined | null
};
	["UploadFileInput"]: {
	name?: string | undefined | null,
	alternativeText?: string | undefined | null,
	caption?: string | undefined | null,
	width?: number | undefined | null,
	height?: number | undefined | null,
	formats?: ResolverInputTypes["JSON"] | undefined | null,
	hash?: string | undefined | null,
	ext?: string | undefined | null,
	mime?: string | undefined | null,
	size?: number | undefined | null,
	url?: string | undefined | null,
	previewUrl?: string | undefined | null,
	provider?: string | undefined | null,
	provider_metadata?: ResolverInputTypes["JSON"] | undefined | null,
	folder?: string | undefined | null,
	folderPath?: string | undefined | null
};
	["UploadFile"]: AliasType<{
	name?:boolean | `@${string}`,
	alternativeText?:boolean | `@${string}`,
	caption?:boolean | `@${string}`,
	width?:boolean | `@${string}`,
	height?:boolean | `@${string}`,
	formats?:boolean | `@${string}`,
	hash?:boolean | `@${string}`,
	ext?:boolean | `@${string}`,
	mime?:boolean | `@${string}`,
	size?:boolean | `@${string}`,
	url?:boolean | `@${string}`,
	previewUrl?:boolean | `@${string}`,
	provider?:boolean | `@${string}`,
	provider_metadata?:boolean | `@${string}`,
	related?:ResolverInputTypes["GenericMorph"],
	createdAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UploadFileEntity"]: AliasType<{
	id?:boolean | `@${string}`,
	attributes?:ResolverInputTypes["UploadFile"],
		__typename?: boolean | `@${string}`
}>;
	["UploadFileEntityResponse"]: AliasType<{
	data?:ResolverInputTypes["UploadFileEntity"],
		__typename?: boolean | `@${string}`
}>;
	["UploadFileEntityResponseCollection"]: AliasType<{
	data?:ResolverInputTypes["UploadFileEntity"],
	meta?:ResolverInputTypes["ResponseCollectionMeta"],
		__typename?: boolean | `@${string}`
}>;
	["UploadFileRelationResponseCollection"]: AliasType<{
	data?:ResolverInputTypes["UploadFileEntity"],
		__typename?: boolean | `@${string}`
}>;
	["UploadFolderFiltersInput"]: {
	id?: ResolverInputTypes["IDFilterInput"] | undefined | null,
	name?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	pathId?: ResolverInputTypes["IntFilterInput"] | undefined | null,
	parent?: ResolverInputTypes["UploadFolderFiltersInput"] | undefined | null,
	children?: ResolverInputTypes["UploadFolderFiltersInput"] | undefined | null,
	files?: ResolverInputTypes["UploadFileFiltersInput"] | undefined | null,
	path?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	and?: Array<ResolverInputTypes["UploadFolderFiltersInput"] | undefined | null> | undefined | null,
	or?: Array<ResolverInputTypes["UploadFolderFiltersInput"] | undefined | null> | undefined | null,
	not?: ResolverInputTypes["UploadFolderFiltersInput"] | undefined | null
};
	["UploadFolderInput"]: {
	name?: string | undefined | null,
	pathId?: number | undefined | null,
	parent?: string | undefined | null,
	children?: Array<string | undefined | null> | undefined | null,
	files?: Array<string | undefined | null> | undefined | null,
	path?: string | undefined | null
};
	["UploadFolder"]: AliasType<{
	name?:boolean | `@${string}`,
	pathId?:boolean | `@${string}`,
	parent?:ResolverInputTypes["UploadFolderEntityResponse"],
children?: [{	filters?: ResolverInputTypes["UploadFolderFiltersInput"] | undefined | null,	pagination?: ResolverInputTypes["PaginationArg"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null},ResolverInputTypes["UploadFolderRelationResponseCollection"]],
files?: [{	filters?: ResolverInputTypes["UploadFileFiltersInput"] | undefined | null,	pagination?: ResolverInputTypes["PaginationArg"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null},ResolverInputTypes["UploadFileRelationResponseCollection"]],
	path?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UploadFolderEntity"]: AliasType<{
	id?:boolean | `@${string}`,
	attributes?:ResolverInputTypes["UploadFolder"],
		__typename?: boolean | `@${string}`
}>;
	["UploadFolderEntityResponse"]: AliasType<{
	data?:ResolverInputTypes["UploadFolderEntity"],
		__typename?: boolean | `@${string}`
}>;
	["UploadFolderEntityResponseCollection"]: AliasType<{
	data?:ResolverInputTypes["UploadFolderEntity"],
	meta?:ResolverInputTypes["ResponseCollectionMeta"],
		__typename?: boolean | `@${string}`
}>;
	["UploadFolderRelationResponseCollection"]: AliasType<{
	data?:ResolverInputTypes["UploadFolderEntity"],
		__typename?: boolean | `@${string}`
}>;
	["I18NLocaleFiltersInput"]: {
	id?: ResolverInputTypes["IDFilterInput"] | undefined | null,
	name?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	code?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	and?: Array<ResolverInputTypes["I18NLocaleFiltersInput"] | undefined | null> | undefined | null,
	or?: Array<ResolverInputTypes["I18NLocaleFiltersInput"] | undefined | null> | undefined | null,
	not?: ResolverInputTypes["I18NLocaleFiltersInput"] | undefined | null
};
	["I18NLocale"]: AliasType<{
	name?:boolean | `@${string}`,
	code?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["I18NLocaleEntity"]: AliasType<{
	id?:boolean | `@${string}`,
	attributes?:ResolverInputTypes["I18NLocale"],
		__typename?: boolean | `@${string}`
}>;
	["I18NLocaleEntityResponse"]: AliasType<{
	data?:ResolverInputTypes["I18NLocaleEntity"],
		__typename?: boolean | `@${string}`
}>;
	["I18NLocaleEntityResponseCollection"]: AliasType<{
	data?:ResolverInputTypes["I18NLocaleEntity"],
	meta?:ResolverInputTypes["ResponseCollectionMeta"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsPermissionFiltersInput"]: {
	id?: ResolverInputTypes["IDFilterInput"] | undefined | null,
	action?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	role?: ResolverInputTypes["UsersPermissionsRoleFiltersInput"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	and?: Array<ResolverInputTypes["UsersPermissionsPermissionFiltersInput"] | undefined | null> | undefined | null,
	or?: Array<ResolverInputTypes["UsersPermissionsPermissionFiltersInput"] | undefined | null> | undefined | null,
	not?: ResolverInputTypes["UsersPermissionsPermissionFiltersInput"] | undefined | null
};
	["UsersPermissionsPermission"]: AliasType<{
	action?:boolean | `@${string}`,
	role?:ResolverInputTypes["UsersPermissionsRoleEntityResponse"],
	createdAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsPermissionEntity"]: AliasType<{
	id?:boolean | `@${string}`,
	attributes?:ResolverInputTypes["UsersPermissionsPermission"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsPermissionRelationResponseCollection"]: AliasType<{
	data?:ResolverInputTypes["UsersPermissionsPermissionEntity"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsRoleFiltersInput"]: {
	id?: ResolverInputTypes["IDFilterInput"] | undefined | null,
	name?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	description?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	type?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	permissions?: ResolverInputTypes["UsersPermissionsPermissionFiltersInput"] | undefined | null,
	users?: ResolverInputTypes["UsersPermissionsUserFiltersInput"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	and?: Array<ResolverInputTypes["UsersPermissionsRoleFiltersInput"] | undefined | null> | undefined | null,
	or?: Array<ResolverInputTypes["UsersPermissionsRoleFiltersInput"] | undefined | null> | undefined | null,
	not?: ResolverInputTypes["UsersPermissionsRoleFiltersInput"] | undefined | null
};
	["UsersPermissionsRoleInput"]: {
	name?: string | undefined | null,
	description?: string | undefined | null,
	type?: string | undefined | null,
	permissions?: Array<string | undefined | null> | undefined | null,
	users?: Array<string | undefined | null> | undefined | null
};
	["UsersPermissionsRole"]: AliasType<{
	name?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
permissions?: [{	filters?: ResolverInputTypes["UsersPermissionsPermissionFiltersInput"] | undefined | null,	pagination?: ResolverInputTypes["PaginationArg"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null},ResolverInputTypes["UsersPermissionsPermissionRelationResponseCollection"]],
users?: [{	filters?: ResolverInputTypes["UsersPermissionsUserFiltersInput"] | undefined | null,	pagination?: ResolverInputTypes["PaginationArg"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null},ResolverInputTypes["UsersPermissionsUserRelationResponseCollection"]],
	createdAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsRoleEntity"]: AliasType<{
	id?:boolean | `@${string}`,
	attributes?:ResolverInputTypes["UsersPermissionsRole"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsRoleEntityResponse"]: AliasType<{
	data?:ResolverInputTypes["UsersPermissionsRoleEntity"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsRoleEntityResponseCollection"]: AliasType<{
	data?:ResolverInputTypes["UsersPermissionsRoleEntity"],
	meta?:ResolverInputTypes["ResponseCollectionMeta"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsUserFiltersInput"]: {
	id?: ResolverInputTypes["IDFilterInput"] | undefined | null,
	username?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	email?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	provider?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	password?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	resetPasswordToken?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	confirmationToken?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	confirmed?: ResolverInputTypes["BooleanFilterInput"] | undefined | null,
	blocked?: ResolverInputTypes["BooleanFilterInput"] | undefined | null,
	role?: ResolverInputTypes["UsersPermissionsRoleFiltersInput"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	and?: Array<ResolverInputTypes["UsersPermissionsUserFiltersInput"] | undefined | null> | undefined | null,
	or?: Array<ResolverInputTypes["UsersPermissionsUserFiltersInput"] | undefined | null> | undefined | null,
	not?: ResolverInputTypes["UsersPermissionsUserFiltersInput"] | undefined | null
};
	["UsersPermissionsUserInput"]: {
	username?: string | undefined | null,
	email?: string | undefined | null,
	provider?: string | undefined | null,
	password?: string | undefined | null,
	resetPasswordToken?: string | undefined | null,
	confirmationToken?: string | undefined | null,
	confirmed?: boolean | undefined | null,
	blocked?: boolean | undefined | null,
	role?: string | undefined | null
};
	["UsersPermissionsUser"]: AliasType<{
	username?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	provider?:boolean | `@${string}`,
	confirmed?:boolean | `@${string}`,
	blocked?:boolean | `@${string}`,
	role?:ResolverInputTypes["UsersPermissionsRoleEntityResponse"],
	createdAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsUserEntity"]: AliasType<{
	id?:boolean | `@${string}`,
	attributes?:ResolverInputTypes["UsersPermissionsUser"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsUserEntityResponse"]: AliasType<{
	data?:ResolverInputTypes["UsersPermissionsUserEntity"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsUserEntityResponseCollection"]: AliasType<{
	data?:ResolverInputTypes["UsersPermissionsUserEntity"],
	meta?:ResolverInputTypes["ResponseCollectionMeta"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsUserRelationResponseCollection"]: AliasType<{
	data?:ResolverInputTypes["UsersPermissionsUserEntity"],
		__typename?: boolean | `@${string}`
}>;
	["MunicipalityFiltersInput"]: {
	id?: ResolverInputTypes["IDFilterInput"] | undefined | null,
	Title?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	publishedAt?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	and?: Array<ResolverInputTypes["MunicipalityFiltersInput"] | undefined | null> | undefined | null,
	or?: Array<ResolverInputTypes["MunicipalityFiltersInput"] | undefined | null> | undefined | null,
	not?: ResolverInputTypes["MunicipalityFiltersInput"] | undefined | null
};
	["MunicipalityInput"]: {
	Title?: string | undefined | null,
	publishedAt?: ResolverInputTypes["DateTime"] | undefined | null
};
	["Municipality"]: AliasType<{
	Title?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	publishedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["MunicipalityEntity"]: AliasType<{
	id?:boolean | `@${string}`,
	attributes?:ResolverInputTypes["Municipality"],
		__typename?: boolean | `@${string}`
}>;
	["MunicipalityEntityResponse"]: AliasType<{
	data?:ResolverInputTypes["MunicipalityEntity"],
		__typename?: boolean | `@${string}`
}>;
	["MunicipalityEntityResponseCollection"]: AliasType<{
	data?:ResolverInputTypes["MunicipalityEntity"],
	meta?:ResolverInputTypes["ResponseCollectionMeta"],
		__typename?: boolean | `@${string}`
}>;
	["MunicipalityRelationResponseCollection"]: AliasType<{
	data?:ResolverInputTypes["MunicipalityEntity"],
		__typename?: boolean | `@${string}`
}>;
	["ProviderFiltersInput"]: {
	id?: ResolverInputTypes["IDFilterInput"] | undefined | null,
	Title?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	services?: ResolverInputTypes["ServiceFiltersInput"] | undefined | null,
	municipalities?: ResolverInputTypes["MunicipalityFiltersInput"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	publishedAt?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	and?: Array<ResolverInputTypes["ProviderFiltersInput"] | undefined | null> | undefined | null,
	or?: Array<ResolverInputTypes["ProviderFiltersInput"] | undefined | null> | undefined | null,
	not?: ResolverInputTypes["ProviderFiltersInput"] | undefined | null
};
	["ProviderInput"]: {
	Title?: string | undefined | null,
	services?: Array<string | undefined | null> | undefined | null,
	municipalities?: Array<string | undefined | null> | undefined | null,
	logo?: string | undefined | null,
	publishedAt?: ResolverInputTypes["DateTime"] | undefined | null
};
	["Provider"]: AliasType<{
	Title?:boolean | `@${string}`,
services?: [{	filters?: ResolverInputTypes["ServiceFiltersInput"] | undefined | null,	pagination?: ResolverInputTypes["PaginationArg"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null,	publicationState?: ResolverInputTypes["PublicationState"] | undefined | null},ResolverInputTypes["ServiceRelationResponseCollection"]],
municipalities?: [{	filters?: ResolverInputTypes["MunicipalityFiltersInput"] | undefined | null,	pagination?: ResolverInputTypes["PaginationArg"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null,	publicationState?: ResolverInputTypes["PublicationState"] | undefined | null},ResolverInputTypes["MunicipalityRelationResponseCollection"]],
	logo?:ResolverInputTypes["UploadFileEntityResponse"],
	createdAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	publishedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ProviderEntity"]: AliasType<{
	id?:boolean | `@${string}`,
	attributes?:ResolverInputTypes["Provider"],
		__typename?: boolean | `@${string}`
}>;
	["ProviderEntityResponse"]: AliasType<{
	data?:ResolverInputTypes["ProviderEntity"],
		__typename?: boolean | `@${string}`
}>;
	["ProviderEntityResponseCollection"]: AliasType<{
	data?:ResolverInputTypes["ProviderEntity"],
	meta?:ResolverInputTypes["ResponseCollectionMeta"],
		__typename?: boolean | `@${string}`
}>;
	["ServiceFiltersInput"]: {
	id?: ResolverInputTypes["IDFilterInput"] | undefined | null,
	Title?: ResolverInputTypes["StringFilterInput"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	publishedAt?: ResolverInputTypes["DateTimeFilterInput"] | undefined | null,
	and?: Array<ResolverInputTypes["ServiceFiltersInput"] | undefined | null> | undefined | null,
	or?: Array<ResolverInputTypes["ServiceFiltersInput"] | undefined | null> | undefined | null,
	not?: ResolverInputTypes["ServiceFiltersInput"] | undefined | null
};
	["ServiceInput"]: {
	Title?: string | undefined | null,
	publishedAt?: ResolverInputTypes["DateTime"] | undefined | null
};
	["Service"]: AliasType<{
	Title?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	publishedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ServiceEntity"]: AliasType<{
	id?:boolean | `@${string}`,
	attributes?:ResolverInputTypes["Service"],
		__typename?: boolean | `@${string}`
}>;
	["ServiceEntityResponse"]: AliasType<{
	data?:ResolverInputTypes["ServiceEntity"],
		__typename?: boolean | `@${string}`
}>;
	["ServiceEntityResponseCollection"]: AliasType<{
	data?:ResolverInputTypes["ServiceEntity"],
	meta?:ResolverInputTypes["ResponseCollectionMeta"],
		__typename?: boolean | `@${string}`
}>;
	["ServiceRelationResponseCollection"]: AliasType<{
	data?:ResolverInputTypes["ServiceEntity"],
		__typename?: boolean | `@${string}`
}>;
	["GenericMorph"]: AliasType<{
	UploadFile?:ResolverInputTypes["UploadFile"],
	UploadFolder?:ResolverInputTypes["UploadFolder"],
	I18NLocale?:ResolverInputTypes["I18NLocale"],
	UsersPermissionsPermission?:ResolverInputTypes["UsersPermissionsPermission"],
	UsersPermissionsRole?:ResolverInputTypes["UsersPermissionsRole"],
	UsersPermissionsUser?:ResolverInputTypes["UsersPermissionsUser"],
	Municipality?:ResolverInputTypes["Municipality"],
	Provider?:ResolverInputTypes["Provider"],
	Service?:ResolverInputTypes["Service"],
		__typename?: boolean | `@${string}`
}>;
	["FileInfoInput"]: {
	name?: string | undefined | null,
	alternativeText?: string | undefined | null,
	caption?: string | undefined | null
};
	["UsersPermissionsMe"]: AliasType<{
	id?:boolean | `@${string}`,
	username?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	confirmed?:boolean | `@${string}`,
	blocked?:boolean | `@${string}`,
	role?:ResolverInputTypes["UsersPermissionsMeRole"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsMeRole"]: AliasType<{
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsRegisterInput"]: {
	username: string,
	email: string,
	password: string
};
	["UsersPermissionsLoginInput"]: {
	identifier: string,
	password: string,
	provider: string
};
	["UsersPermissionsPasswordPayload"]: AliasType<{
	ok?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsLoginPayload"]: AliasType<{
	jwt?:boolean | `@${string}`,
	user?:ResolverInputTypes["UsersPermissionsMe"],
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsCreateRolePayload"]: AliasType<{
	ok?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsUpdateRolePayload"]: AliasType<{
	ok?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersPermissionsDeleteRolePayload"]: AliasType<{
	ok?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["PaginationArg"]: {
	page?: number | undefined | null,
	pageSize?: number | undefined | null,
	start?: number | undefined | null,
	limit?: number | undefined | null
};
	["Query"]: AliasType<{
uploadFile?: [{	id?: string | undefined | null},ResolverInputTypes["UploadFileEntityResponse"]],
uploadFiles?: [{	filters?: ResolverInputTypes["UploadFileFiltersInput"] | undefined | null,	pagination?: ResolverInputTypes["PaginationArg"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null},ResolverInputTypes["UploadFileEntityResponseCollection"]],
uploadFolder?: [{	id?: string | undefined | null},ResolverInputTypes["UploadFolderEntityResponse"]],
uploadFolders?: [{	filters?: ResolverInputTypes["UploadFolderFiltersInput"] | undefined | null,	pagination?: ResolverInputTypes["PaginationArg"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null},ResolverInputTypes["UploadFolderEntityResponseCollection"]],
i18NLocale?: [{	id?: string | undefined | null},ResolverInputTypes["I18NLocaleEntityResponse"]],
i18NLocales?: [{	filters?: ResolverInputTypes["I18NLocaleFiltersInput"] | undefined | null,	pagination?: ResolverInputTypes["PaginationArg"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null},ResolverInputTypes["I18NLocaleEntityResponseCollection"]],
usersPermissionsRole?: [{	id?: string | undefined | null},ResolverInputTypes["UsersPermissionsRoleEntityResponse"]],
usersPermissionsRoles?: [{	filters?: ResolverInputTypes["UsersPermissionsRoleFiltersInput"] | undefined | null,	pagination?: ResolverInputTypes["PaginationArg"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null},ResolverInputTypes["UsersPermissionsRoleEntityResponseCollection"]],
usersPermissionsUser?: [{	id?: string | undefined | null},ResolverInputTypes["UsersPermissionsUserEntityResponse"]],
usersPermissionsUsers?: [{	filters?: ResolverInputTypes["UsersPermissionsUserFiltersInput"] | undefined | null,	pagination?: ResolverInputTypes["PaginationArg"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null},ResolverInputTypes["UsersPermissionsUserEntityResponseCollection"]],
municipality?: [{	id?: string | undefined | null},ResolverInputTypes["MunicipalityEntityResponse"]],
municipalities?: [{	filters?: ResolverInputTypes["MunicipalityFiltersInput"] | undefined | null,	pagination?: ResolverInputTypes["PaginationArg"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null,	publicationState?: ResolverInputTypes["PublicationState"] | undefined | null},ResolverInputTypes["MunicipalityEntityResponseCollection"]],
provider?: [{	id?: string | undefined | null},ResolverInputTypes["ProviderEntityResponse"]],
providers?: [{	filters?: ResolverInputTypes["ProviderFiltersInput"] | undefined | null,	pagination?: ResolverInputTypes["PaginationArg"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null,	publicationState?: ResolverInputTypes["PublicationState"] | undefined | null},ResolverInputTypes["ProviderEntityResponseCollection"]],
service?: [{	id?: string | undefined | null},ResolverInputTypes["ServiceEntityResponse"]],
services?: [{	filters?: ResolverInputTypes["ServiceFiltersInput"] | undefined | null,	pagination?: ResolverInputTypes["PaginationArg"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null,	publicationState?: ResolverInputTypes["PublicationState"] | undefined | null},ResolverInputTypes["ServiceEntityResponseCollection"]],
	me?:ResolverInputTypes["UsersPermissionsMe"],
		__typename?: boolean | `@${string}`
}>;
	["Mutation"]: AliasType<{
createUploadFile?: [{	data: ResolverInputTypes["UploadFileInput"]},ResolverInputTypes["UploadFileEntityResponse"]],
updateUploadFile?: [{	id: string,	data: ResolverInputTypes["UploadFileInput"]},ResolverInputTypes["UploadFileEntityResponse"]],
deleteUploadFile?: [{	id: string},ResolverInputTypes["UploadFileEntityResponse"]],
createUploadFolder?: [{	data: ResolverInputTypes["UploadFolderInput"]},ResolverInputTypes["UploadFolderEntityResponse"]],
updateUploadFolder?: [{	id: string,	data: ResolverInputTypes["UploadFolderInput"]},ResolverInputTypes["UploadFolderEntityResponse"]],
deleteUploadFolder?: [{	id: string},ResolverInputTypes["UploadFolderEntityResponse"]],
createMunicipality?: [{	data: ResolverInputTypes["MunicipalityInput"]},ResolverInputTypes["MunicipalityEntityResponse"]],
updateMunicipality?: [{	id: string,	data: ResolverInputTypes["MunicipalityInput"]},ResolverInputTypes["MunicipalityEntityResponse"]],
deleteMunicipality?: [{	id: string},ResolverInputTypes["MunicipalityEntityResponse"]],
createProvider?: [{	data: ResolverInputTypes["ProviderInput"]},ResolverInputTypes["ProviderEntityResponse"]],
updateProvider?: [{	id: string,	data: ResolverInputTypes["ProviderInput"]},ResolverInputTypes["ProviderEntityResponse"]],
deleteProvider?: [{	id: string},ResolverInputTypes["ProviderEntityResponse"]],
createService?: [{	data: ResolverInputTypes["ServiceInput"]},ResolverInputTypes["ServiceEntityResponse"]],
updateService?: [{	id: string,	data: ResolverInputTypes["ServiceInput"]},ResolverInputTypes["ServiceEntityResponse"]],
deleteService?: [{	id: string},ResolverInputTypes["ServiceEntityResponse"]],
upload?: [{	refId?: string | undefined | null,	ref?: string | undefined | null,	field?: string | undefined | null,	info?: ResolverInputTypes["FileInfoInput"] | undefined | null,	file: ResolverInputTypes["Upload"]},ResolverInputTypes["UploadFileEntityResponse"]],
multipleUpload?: [{	refId?: string | undefined | null,	ref?: string | undefined | null,	field?: string | undefined | null,	files: Array<ResolverInputTypes["Upload"] | undefined | null>},ResolverInputTypes["UploadFileEntityResponse"]],
updateFileInfo?: [{	id: string,	info?: ResolverInputTypes["FileInfoInput"] | undefined | null},ResolverInputTypes["UploadFileEntityResponse"]],
removeFile?: [{	id: string},ResolverInputTypes["UploadFileEntityResponse"]],
createUsersPermissionsRole?: [{	data: ResolverInputTypes["UsersPermissionsRoleInput"]},ResolverInputTypes["UsersPermissionsCreateRolePayload"]],
updateUsersPermissionsRole?: [{	id: string,	data: ResolverInputTypes["UsersPermissionsRoleInput"]},ResolverInputTypes["UsersPermissionsUpdateRolePayload"]],
deleteUsersPermissionsRole?: [{	id: string},ResolverInputTypes["UsersPermissionsDeleteRolePayload"]],
createUsersPermissionsUser?: [{	data: ResolverInputTypes["UsersPermissionsUserInput"]},ResolverInputTypes["UsersPermissionsUserEntityResponse"]],
updateUsersPermissionsUser?: [{	id: string,	data: ResolverInputTypes["UsersPermissionsUserInput"]},ResolverInputTypes["UsersPermissionsUserEntityResponse"]],
deleteUsersPermissionsUser?: [{	id: string},ResolverInputTypes["UsersPermissionsUserEntityResponse"]],
login?: [{	input: ResolverInputTypes["UsersPermissionsLoginInput"]},ResolverInputTypes["UsersPermissionsLoginPayload"]],
register?: [{	input: ResolverInputTypes["UsersPermissionsRegisterInput"]},ResolverInputTypes["UsersPermissionsLoginPayload"]],
forgotPassword?: [{	email: string},ResolverInputTypes["UsersPermissionsPasswordPayload"]],
resetPassword?: [{	password: string,	passwordConfirmation: string,	code: string},ResolverInputTypes["UsersPermissionsLoginPayload"]],
changePassword?: [{	currentPassword: string,	password: string,	passwordConfirmation: string},ResolverInputTypes["UsersPermissionsLoginPayload"]],
emailConfirmation?: [{	confirmation: string},ResolverInputTypes["UsersPermissionsLoginPayload"]],
		__typename?: boolean | `@${string}`
}>
  }

export type ModelTypes = {
    /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
["JSON"]:any;
	/** A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the `date-time` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar. */
["DateTime"]:any;
	/** The `Upload` scalar type represents a file upload. */
["Upload"]:any;
	["Pagination"]: {
		total: number,
	page: number,
	pageSize: number,
	pageCount: number
};
	["ResponseCollectionMeta"]: {
		pagination: ModelTypes["Pagination"]
};
	["PublicationState"]:PublicationState;
	["IDFilterInput"]: {
	and?: Array<string | undefined> | undefined,
	or?: Array<string | undefined> | undefined,
	not?: ModelTypes["IDFilterInput"] | undefined,
	eq?: string | undefined,
	eqi?: string | undefined,
	ne?: string | undefined,
	startsWith?: string | undefined,
	endsWith?: string | undefined,
	contains?: string | undefined,
	notContains?: string | undefined,
	containsi?: string | undefined,
	notContainsi?: string | undefined,
	gt?: string | undefined,
	gte?: string | undefined,
	lt?: string | undefined,
	lte?: string | undefined,
	null?: boolean | undefined,
	notNull?: boolean | undefined,
	in?: Array<string | undefined> | undefined,
	notIn?: Array<string | undefined> | undefined,
	between?: Array<string | undefined> | undefined
};
	["BooleanFilterInput"]: {
	and?: Array<boolean | undefined> | undefined,
	or?: Array<boolean | undefined> | undefined,
	not?: ModelTypes["BooleanFilterInput"] | undefined,
	eq?: boolean | undefined,
	eqi?: boolean | undefined,
	ne?: boolean | undefined,
	startsWith?: boolean | undefined,
	endsWith?: boolean | undefined,
	contains?: boolean | undefined,
	notContains?: boolean | undefined,
	containsi?: boolean | undefined,
	notContainsi?: boolean | undefined,
	gt?: boolean | undefined,
	gte?: boolean | undefined,
	lt?: boolean | undefined,
	lte?: boolean | undefined,
	null?: boolean | undefined,
	notNull?: boolean | undefined,
	in?: Array<boolean | undefined> | undefined,
	notIn?: Array<boolean | undefined> | undefined,
	between?: Array<boolean | undefined> | undefined
};
	["StringFilterInput"]: {
	and?: Array<string | undefined> | undefined,
	or?: Array<string | undefined> | undefined,
	not?: ModelTypes["StringFilterInput"] | undefined,
	eq?: string | undefined,
	eqi?: string | undefined,
	ne?: string | undefined,
	startsWith?: string | undefined,
	endsWith?: string | undefined,
	contains?: string | undefined,
	notContains?: string | undefined,
	containsi?: string | undefined,
	notContainsi?: string | undefined,
	gt?: string | undefined,
	gte?: string | undefined,
	lt?: string | undefined,
	lte?: string | undefined,
	null?: boolean | undefined,
	notNull?: boolean | undefined,
	in?: Array<string | undefined> | undefined,
	notIn?: Array<string | undefined> | undefined,
	between?: Array<string | undefined> | undefined
};
	["IntFilterInput"]: {
	and?: Array<number | undefined> | undefined,
	or?: Array<number | undefined> | undefined,
	not?: ModelTypes["IntFilterInput"] | undefined,
	eq?: number | undefined,
	eqi?: number | undefined,
	ne?: number | undefined,
	startsWith?: number | undefined,
	endsWith?: number | undefined,
	contains?: number | undefined,
	notContains?: number | undefined,
	containsi?: number | undefined,
	notContainsi?: number | undefined,
	gt?: number | undefined,
	gte?: number | undefined,
	lt?: number | undefined,
	lte?: number | undefined,
	null?: boolean | undefined,
	notNull?: boolean | undefined,
	in?: Array<number | undefined> | undefined,
	notIn?: Array<number | undefined> | undefined,
	between?: Array<number | undefined> | undefined
};
	["FloatFilterInput"]: {
	and?: Array<number | undefined> | undefined,
	or?: Array<number | undefined> | undefined,
	not?: ModelTypes["FloatFilterInput"] | undefined,
	eq?: number | undefined,
	eqi?: number | undefined,
	ne?: number | undefined,
	startsWith?: number | undefined,
	endsWith?: number | undefined,
	contains?: number | undefined,
	notContains?: number | undefined,
	containsi?: number | undefined,
	notContainsi?: number | undefined,
	gt?: number | undefined,
	gte?: number | undefined,
	lt?: number | undefined,
	lte?: number | undefined,
	null?: boolean | undefined,
	notNull?: boolean | undefined,
	in?: Array<number | undefined> | undefined,
	notIn?: Array<number | undefined> | undefined,
	between?: Array<number | undefined> | undefined
};
	["DateTimeFilterInput"]: {
	and?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	or?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	not?: ModelTypes["DateTimeFilterInput"] | undefined,
	eq?: ModelTypes["DateTime"] | undefined,
	eqi?: ModelTypes["DateTime"] | undefined,
	ne?: ModelTypes["DateTime"] | undefined,
	startsWith?: ModelTypes["DateTime"] | undefined,
	endsWith?: ModelTypes["DateTime"] | undefined,
	contains?: ModelTypes["DateTime"] | undefined,
	notContains?: ModelTypes["DateTime"] | undefined,
	containsi?: ModelTypes["DateTime"] | undefined,
	notContainsi?: ModelTypes["DateTime"] | undefined,
	gt?: ModelTypes["DateTime"] | undefined,
	gte?: ModelTypes["DateTime"] | undefined,
	lt?: ModelTypes["DateTime"] | undefined,
	lte?: ModelTypes["DateTime"] | undefined,
	null?: boolean | undefined,
	notNull?: boolean | undefined,
	in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	notIn?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	between?: Array<ModelTypes["DateTime"] | undefined> | undefined
};
	["JSONFilterInput"]: {
	and?: Array<ModelTypes["JSON"] | undefined> | undefined,
	or?: Array<ModelTypes["JSON"] | undefined> | undefined,
	not?: ModelTypes["JSONFilterInput"] | undefined,
	eq?: ModelTypes["JSON"] | undefined,
	eqi?: ModelTypes["JSON"] | undefined,
	ne?: ModelTypes["JSON"] | undefined,
	startsWith?: ModelTypes["JSON"] | undefined,
	endsWith?: ModelTypes["JSON"] | undefined,
	contains?: ModelTypes["JSON"] | undefined,
	notContains?: ModelTypes["JSON"] | undefined,
	containsi?: ModelTypes["JSON"] | undefined,
	notContainsi?: ModelTypes["JSON"] | undefined,
	gt?: ModelTypes["JSON"] | undefined,
	gte?: ModelTypes["JSON"] | undefined,
	lt?: ModelTypes["JSON"] | undefined,
	lte?: ModelTypes["JSON"] | undefined,
	null?: boolean | undefined,
	notNull?: boolean | undefined,
	in?: Array<ModelTypes["JSON"] | undefined> | undefined,
	notIn?: Array<ModelTypes["JSON"] | undefined> | undefined,
	between?: Array<ModelTypes["JSON"] | undefined> | undefined
};
	["UploadFileFiltersInput"]: {
	id?: ModelTypes["IDFilterInput"] | undefined,
	name?: ModelTypes["StringFilterInput"] | undefined,
	alternativeText?: ModelTypes["StringFilterInput"] | undefined,
	caption?: ModelTypes["StringFilterInput"] | undefined,
	width?: ModelTypes["IntFilterInput"] | undefined,
	height?: ModelTypes["IntFilterInput"] | undefined,
	formats?: ModelTypes["JSONFilterInput"] | undefined,
	hash?: ModelTypes["StringFilterInput"] | undefined,
	ext?: ModelTypes["StringFilterInput"] | undefined,
	mime?: ModelTypes["StringFilterInput"] | undefined,
	size?: ModelTypes["FloatFilterInput"] | undefined,
	url?: ModelTypes["StringFilterInput"] | undefined,
	previewUrl?: ModelTypes["StringFilterInput"] | undefined,
	provider?: ModelTypes["StringFilterInput"] | undefined,
	provider_metadata?: ModelTypes["JSONFilterInput"] | undefined,
	folder?: ModelTypes["UploadFolderFiltersInput"] | undefined,
	folderPath?: ModelTypes["StringFilterInput"] | undefined,
	createdAt?: ModelTypes["DateTimeFilterInput"] | undefined,
	updatedAt?: ModelTypes["DateTimeFilterInput"] | undefined,
	and?: Array<ModelTypes["UploadFileFiltersInput"] | undefined> | undefined,
	or?: Array<ModelTypes["UploadFileFiltersInput"] | undefined> | undefined,
	not?: ModelTypes["UploadFileFiltersInput"] | undefined
};
	["UploadFileInput"]: {
	name?: string | undefined,
	alternativeText?: string | undefined,
	caption?: string | undefined,
	width?: number | undefined,
	height?: number | undefined,
	formats?: ModelTypes["JSON"] | undefined,
	hash?: string | undefined,
	ext?: string | undefined,
	mime?: string | undefined,
	size?: number | undefined,
	url?: string | undefined,
	previewUrl?: string | undefined,
	provider?: string | undefined,
	provider_metadata?: ModelTypes["JSON"] | undefined,
	folder?: string | undefined,
	folderPath?: string | undefined
};
	["UploadFile"]: {
		name: string,
	alternativeText?: string | undefined,
	caption?: string | undefined,
	width?: number | undefined,
	height?: number | undefined,
	formats?: ModelTypes["JSON"] | undefined,
	hash: string,
	ext?: string | undefined,
	mime: string,
	size: number,
	url: string,
	previewUrl?: string | undefined,
	provider: string,
	provider_metadata?: ModelTypes["JSON"] | undefined,
	related?: Array<ModelTypes["GenericMorph"] | undefined> | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined
};
	["UploadFileEntity"]: {
		id?: string | undefined,
	attributes?: ModelTypes["UploadFile"] | undefined
};
	["UploadFileEntityResponse"]: {
		data?: ModelTypes["UploadFileEntity"] | undefined
};
	["UploadFileEntityResponseCollection"]: {
		data: Array<ModelTypes["UploadFileEntity"]>,
	meta: ModelTypes["ResponseCollectionMeta"]
};
	["UploadFileRelationResponseCollection"]: {
		data: Array<ModelTypes["UploadFileEntity"]>
};
	["UploadFolderFiltersInput"]: {
	id?: ModelTypes["IDFilterInput"] | undefined,
	name?: ModelTypes["StringFilterInput"] | undefined,
	pathId?: ModelTypes["IntFilterInput"] | undefined,
	parent?: ModelTypes["UploadFolderFiltersInput"] | undefined,
	children?: ModelTypes["UploadFolderFiltersInput"] | undefined,
	files?: ModelTypes["UploadFileFiltersInput"] | undefined,
	path?: ModelTypes["StringFilterInput"] | undefined,
	createdAt?: ModelTypes["DateTimeFilterInput"] | undefined,
	updatedAt?: ModelTypes["DateTimeFilterInput"] | undefined,
	and?: Array<ModelTypes["UploadFolderFiltersInput"] | undefined> | undefined,
	or?: Array<ModelTypes["UploadFolderFiltersInput"] | undefined> | undefined,
	not?: ModelTypes["UploadFolderFiltersInput"] | undefined
};
	["UploadFolderInput"]: {
	name?: string | undefined,
	pathId?: number | undefined,
	parent?: string | undefined,
	children?: Array<string | undefined> | undefined,
	files?: Array<string | undefined> | undefined,
	path?: string | undefined
};
	["UploadFolder"]: {
		name: string,
	pathId: number,
	parent?: ModelTypes["UploadFolderEntityResponse"] | undefined,
	children?: ModelTypes["UploadFolderRelationResponseCollection"] | undefined,
	files?: ModelTypes["UploadFileRelationResponseCollection"] | undefined,
	path: string,
	createdAt?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined
};
	["UploadFolderEntity"]: {
		id?: string | undefined,
	attributes?: ModelTypes["UploadFolder"] | undefined
};
	["UploadFolderEntityResponse"]: {
		data?: ModelTypes["UploadFolderEntity"] | undefined
};
	["UploadFolderEntityResponseCollection"]: {
		data: Array<ModelTypes["UploadFolderEntity"]>,
	meta: ModelTypes["ResponseCollectionMeta"]
};
	["UploadFolderRelationResponseCollection"]: {
		data: Array<ModelTypes["UploadFolderEntity"]>
};
	["I18NLocaleFiltersInput"]: {
	id?: ModelTypes["IDFilterInput"] | undefined,
	name?: ModelTypes["StringFilterInput"] | undefined,
	code?: ModelTypes["StringFilterInput"] | undefined,
	createdAt?: ModelTypes["DateTimeFilterInput"] | undefined,
	updatedAt?: ModelTypes["DateTimeFilterInput"] | undefined,
	and?: Array<ModelTypes["I18NLocaleFiltersInput"] | undefined> | undefined,
	or?: Array<ModelTypes["I18NLocaleFiltersInput"] | undefined> | undefined,
	not?: ModelTypes["I18NLocaleFiltersInput"] | undefined
};
	["I18NLocale"]: {
		name?: string | undefined,
	code?: string | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined
};
	["I18NLocaleEntity"]: {
		id?: string | undefined,
	attributes?: ModelTypes["I18NLocale"] | undefined
};
	["I18NLocaleEntityResponse"]: {
		data?: ModelTypes["I18NLocaleEntity"] | undefined
};
	["I18NLocaleEntityResponseCollection"]: {
		data: Array<ModelTypes["I18NLocaleEntity"]>,
	meta: ModelTypes["ResponseCollectionMeta"]
};
	["UsersPermissionsPermissionFiltersInput"]: {
	id?: ModelTypes["IDFilterInput"] | undefined,
	action?: ModelTypes["StringFilterInput"] | undefined,
	role?: ModelTypes["UsersPermissionsRoleFiltersInput"] | undefined,
	createdAt?: ModelTypes["DateTimeFilterInput"] | undefined,
	updatedAt?: ModelTypes["DateTimeFilterInput"] | undefined,
	and?: Array<ModelTypes["UsersPermissionsPermissionFiltersInput"] | undefined> | undefined,
	or?: Array<ModelTypes["UsersPermissionsPermissionFiltersInput"] | undefined> | undefined,
	not?: ModelTypes["UsersPermissionsPermissionFiltersInput"] | undefined
};
	["UsersPermissionsPermission"]: {
		action: string,
	role?: ModelTypes["UsersPermissionsRoleEntityResponse"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined
};
	["UsersPermissionsPermissionEntity"]: {
		id?: string | undefined,
	attributes?: ModelTypes["UsersPermissionsPermission"] | undefined
};
	["UsersPermissionsPermissionRelationResponseCollection"]: {
		data: Array<ModelTypes["UsersPermissionsPermissionEntity"]>
};
	["UsersPermissionsRoleFiltersInput"]: {
	id?: ModelTypes["IDFilterInput"] | undefined,
	name?: ModelTypes["StringFilterInput"] | undefined,
	description?: ModelTypes["StringFilterInput"] | undefined,
	type?: ModelTypes["StringFilterInput"] | undefined,
	permissions?: ModelTypes["UsersPermissionsPermissionFiltersInput"] | undefined,
	users?: ModelTypes["UsersPermissionsUserFiltersInput"] | undefined,
	createdAt?: ModelTypes["DateTimeFilterInput"] | undefined,
	updatedAt?: ModelTypes["DateTimeFilterInput"] | undefined,
	and?: Array<ModelTypes["UsersPermissionsRoleFiltersInput"] | undefined> | undefined,
	or?: Array<ModelTypes["UsersPermissionsRoleFiltersInput"] | undefined> | undefined,
	not?: ModelTypes["UsersPermissionsRoleFiltersInput"] | undefined
};
	["UsersPermissionsRoleInput"]: {
	name?: string | undefined,
	description?: string | undefined,
	type?: string | undefined,
	permissions?: Array<string | undefined> | undefined,
	users?: Array<string | undefined> | undefined
};
	["UsersPermissionsRole"]: {
		name: string,
	description?: string | undefined,
	type?: string | undefined,
	permissions?: ModelTypes["UsersPermissionsPermissionRelationResponseCollection"] | undefined,
	users?: ModelTypes["UsersPermissionsUserRelationResponseCollection"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined
};
	["UsersPermissionsRoleEntity"]: {
		id?: string | undefined,
	attributes?: ModelTypes["UsersPermissionsRole"] | undefined
};
	["UsersPermissionsRoleEntityResponse"]: {
		data?: ModelTypes["UsersPermissionsRoleEntity"] | undefined
};
	["UsersPermissionsRoleEntityResponseCollection"]: {
		data: Array<ModelTypes["UsersPermissionsRoleEntity"]>,
	meta: ModelTypes["ResponseCollectionMeta"]
};
	["UsersPermissionsUserFiltersInput"]: {
	id?: ModelTypes["IDFilterInput"] | undefined,
	username?: ModelTypes["StringFilterInput"] | undefined,
	email?: ModelTypes["StringFilterInput"] | undefined,
	provider?: ModelTypes["StringFilterInput"] | undefined,
	password?: ModelTypes["StringFilterInput"] | undefined,
	resetPasswordToken?: ModelTypes["StringFilterInput"] | undefined,
	confirmationToken?: ModelTypes["StringFilterInput"] | undefined,
	confirmed?: ModelTypes["BooleanFilterInput"] | undefined,
	blocked?: ModelTypes["BooleanFilterInput"] | undefined,
	role?: ModelTypes["UsersPermissionsRoleFiltersInput"] | undefined,
	createdAt?: ModelTypes["DateTimeFilterInput"] | undefined,
	updatedAt?: ModelTypes["DateTimeFilterInput"] | undefined,
	and?: Array<ModelTypes["UsersPermissionsUserFiltersInput"] | undefined> | undefined,
	or?: Array<ModelTypes["UsersPermissionsUserFiltersInput"] | undefined> | undefined,
	not?: ModelTypes["UsersPermissionsUserFiltersInput"] | undefined
};
	["UsersPermissionsUserInput"]: {
	username?: string | undefined,
	email?: string | undefined,
	provider?: string | undefined,
	password?: string | undefined,
	resetPasswordToken?: string | undefined,
	confirmationToken?: string | undefined,
	confirmed?: boolean | undefined,
	blocked?: boolean | undefined,
	role?: string | undefined
};
	["UsersPermissionsUser"]: {
		username: string,
	email: string,
	provider?: string | undefined,
	confirmed?: boolean | undefined,
	blocked?: boolean | undefined,
	role?: ModelTypes["UsersPermissionsRoleEntityResponse"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined
};
	["UsersPermissionsUserEntity"]: {
		id?: string | undefined,
	attributes?: ModelTypes["UsersPermissionsUser"] | undefined
};
	["UsersPermissionsUserEntityResponse"]: {
		data?: ModelTypes["UsersPermissionsUserEntity"] | undefined
};
	["UsersPermissionsUserEntityResponseCollection"]: {
		data: Array<ModelTypes["UsersPermissionsUserEntity"]>,
	meta: ModelTypes["ResponseCollectionMeta"]
};
	["UsersPermissionsUserRelationResponseCollection"]: {
		data: Array<ModelTypes["UsersPermissionsUserEntity"]>
};
	["MunicipalityFiltersInput"]: {
	id?: ModelTypes["IDFilterInput"] | undefined,
	Title?: ModelTypes["StringFilterInput"] | undefined,
	createdAt?: ModelTypes["DateTimeFilterInput"] | undefined,
	updatedAt?: ModelTypes["DateTimeFilterInput"] | undefined,
	publishedAt?: ModelTypes["DateTimeFilterInput"] | undefined,
	and?: Array<ModelTypes["MunicipalityFiltersInput"] | undefined> | undefined,
	or?: Array<ModelTypes["MunicipalityFiltersInput"] | undefined> | undefined,
	not?: ModelTypes["MunicipalityFiltersInput"] | undefined
};
	["MunicipalityInput"]: {
	Title?: string | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined
};
	["Municipality"]: {
		Title?: string | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined
};
	["MunicipalityEntity"]: {
		id?: string | undefined,
	attributes?: ModelTypes["Municipality"] | undefined
};
	["MunicipalityEntityResponse"]: {
		data?: ModelTypes["MunicipalityEntity"] | undefined
};
	["MunicipalityEntityResponseCollection"]: {
		data: Array<ModelTypes["MunicipalityEntity"]>,
	meta: ModelTypes["ResponseCollectionMeta"]
};
	["MunicipalityRelationResponseCollection"]: {
		data: Array<ModelTypes["MunicipalityEntity"]>
};
	["ProviderFiltersInput"]: {
	id?: ModelTypes["IDFilterInput"] | undefined,
	Title?: ModelTypes["StringFilterInput"] | undefined,
	services?: ModelTypes["ServiceFiltersInput"] | undefined,
	municipalities?: ModelTypes["MunicipalityFiltersInput"] | undefined,
	createdAt?: ModelTypes["DateTimeFilterInput"] | undefined,
	updatedAt?: ModelTypes["DateTimeFilterInput"] | undefined,
	publishedAt?: ModelTypes["DateTimeFilterInput"] | undefined,
	and?: Array<ModelTypes["ProviderFiltersInput"] | undefined> | undefined,
	or?: Array<ModelTypes["ProviderFiltersInput"] | undefined> | undefined,
	not?: ModelTypes["ProviderFiltersInput"] | undefined
};
	["ProviderInput"]: {
	Title?: string | undefined,
	services?: Array<string | undefined> | undefined,
	municipalities?: Array<string | undefined> | undefined,
	logo?: string | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined
};
	["Provider"]: {
		Title?: string | undefined,
	services?: ModelTypes["ServiceRelationResponseCollection"] | undefined,
	municipalities?: ModelTypes["MunicipalityRelationResponseCollection"] | undefined,
	logo?: ModelTypes["UploadFileEntityResponse"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined
};
	["ProviderEntity"]: {
		id?: string | undefined,
	attributes?: ModelTypes["Provider"] | undefined
};
	["ProviderEntityResponse"]: {
		data?: ModelTypes["ProviderEntity"] | undefined
};
	["ProviderEntityResponseCollection"]: {
		data: Array<ModelTypes["ProviderEntity"]>,
	meta: ModelTypes["ResponseCollectionMeta"]
};
	["ServiceFiltersInput"]: {
	id?: ModelTypes["IDFilterInput"] | undefined,
	Title?: ModelTypes["StringFilterInput"] | undefined,
	createdAt?: ModelTypes["DateTimeFilterInput"] | undefined,
	updatedAt?: ModelTypes["DateTimeFilterInput"] | undefined,
	publishedAt?: ModelTypes["DateTimeFilterInput"] | undefined,
	and?: Array<ModelTypes["ServiceFiltersInput"] | undefined> | undefined,
	or?: Array<ModelTypes["ServiceFiltersInput"] | undefined> | undefined,
	not?: ModelTypes["ServiceFiltersInput"] | undefined
};
	["ServiceInput"]: {
	Title?: string | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined
};
	["Service"]: {
		Title?: string | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined
};
	["ServiceEntity"]: {
		id?: string | undefined,
	attributes?: ModelTypes["Service"] | undefined
};
	["ServiceEntityResponse"]: {
		data?: ModelTypes["ServiceEntity"] | undefined
};
	["ServiceEntityResponseCollection"]: {
		data: Array<ModelTypes["ServiceEntity"]>,
	meta: ModelTypes["ResponseCollectionMeta"]
};
	["ServiceRelationResponseCollection"]: {
		data: Array<ModelTypes["ServiceEntity"]>
};
	["GenericMorph"]:ModelTypes["UploadFile"] | ModelTypes["UploadFolder"] | ModelTypes["I18NLocale"] | ModelTypes["UsersPermissionsPermission"] | ModelTypes["UsersPermissionsRole"] | ModelTypes["UsersPermissionsUser"] | ModelTypes["Municipality"] | ModelTypes["Provider"] | ModelTypes["Service"];
	["FileInfoInput"]: {
	name?: string | undefined,
	alternativeText?: string | undefined,
	caption?: string | undefined
};
	["UsersPermissionsMe"]: {
		id: string,
	username: string,
	email?: string | undefined,
	confirmed?: boolean | undefined,
	blocked?: boolean | undefined,
	role?: ModelTypes["UsersPermissionsMeRole"] | undefined
};
	["UsersPermissionsMeRole"]: {
		id: string,
	name: string,
	description?: string | undefined,
	type?: string | undefined
};
	["UsersPermissionsRegisterInput"]: {
	username: string,
	email: string,
	password: string
};
	["UsersPermissionsLoginInput"]: {
	identifier: string,
	password: string,
	provider: string
};
	["UsersPermissionsPasswordPayload"]: {
		ok: boolean
};
	["UsersPermissionsLoginPayload"]: {
		jwt?: string | undefined,
	user: ModelTypes["UsersPermissionsMe"]
};
	["UsersPermissionsCreateRolePayload"]: {
		ok: boolean
};
	["UsersPermissionsUpdateRolePayload"]: {
		ok: boolean
};
	["UsersPermissionsDeleteRolePayload"]: {
		ok: boolean
};
	["PaginationArg"]: {
	page?: number | undefined,
	pageSize?: number | undefined,
	start?: number | undefined,
	limit?: number | undefined
};
	["Query"]: {
		uploadFile?: ModelTypes["UploadFileEntityResponse"] | undefined,
	uploadFiles?: ModelTypes["UploadFileEntityResponseCollection"] | undefined,
	uploadFolder?: ModelTypes["UploadFolderEntityResponse"] | undefined,
	uploadFolders?: ModelTypes["UploadFolderEntityResponseCollection"] | undefined,
	i18NLocale?: ModelTypes["I18NLocaleEntityResponse"] | undefined,
	i18NLocales?: ModelTypes["I18NLocaleEntityResponseCollection"] | undefined,
	usersPermissionsRole?: ModelTypes["UsersPermissionsRoleEntityResponse"] | undefined,
	usersPermissionsRoles?: ModelTypes["UsersPermissionsRoleEntityResponseCollection"] | undefined,
	usersPermissionsUser?: ModelTypes["UsersPermissionsUserEntityResponse"] | undefined,
	usersPermissionsUsers?: ModelTypes["UsersPermissionsUserEntityResponseCollection"] | undefined,
	municipality?: ModelTypes["MunicipalityEntityResponse"] | undefined,
	municipalities?: ModelTypes["MunicipalityEntityResponseCollection"] | undefined,
	provider?: ModelTypes["ProviderEntityResponse"] | undefined,
	providers?: ModelTypes["ProviderEntityResponseCollection"] | undefined,
	service?: ModelTypes["ServiceEntityResponse"] | undefined,
	services?: ModelTypes["ServiceEntityResponseCollection"] | undefined,
	me?: ModelTypes["UsersPermissionsMe"] | undefined
};
	["Mutation"]: {
		createUploadFile?: ModelTypes["UploadFileEntityResponse"] | undefined,
	updateUploadFile?: ModelTypes["UploadFileEntityResponse"] | undefined,
	deleteUploadFile?: ModelTypes["UploadFileEntityResponse"] | undefined,
	createUploadFolder?: ModelTypes["UploadFolderEntityResponse"] | undefined,
	updateUploadFolder?: ModelTypes["UploadFolderEntityResponse"] | undefined,
	deleteUploadFolder?: ModelTypes["UploadFolderEntityResponse"] | undefined,
	createMunicipality?: ModelTypes["MunicipalityEntityResponse"] | undefined,
	updateMunicipality?: ModelTypes["MunicipalityEntityResponse"] | undefined,
	deleteMunicipality?: ModelTypes["MunicipalityEntityResponse"] | undefined,
	createProvider?: ModelTypes["ProviderEntityResponse"] | undefined,
	updateProvider?: ModelTypes["ProviderEntityResponse"] | undefined,
	deleteProvider?: ModelTypes["ProviderEntityResponse"] | undefined,
	createService?: ModelTypes["ServiceEntityResponse"] | undefined,
	updateService?: ModelTypes["ServiceEntityResponse"] | undefined,
	deleteService?: ModelTypes["ServiceEntityResponse"] | undefined,
	upload: ModelTypes["UploadFileEntityResponse"],
	multipleUpload: Array<ModelTypes["UploadFileEntityResponse"] | undefined>,
	updateFileInfo: ModelTypes["UploadFileEntityResponse"],
	removeFile?: ModelTypes["UploadFileEntityResponse"] | undefined,
	/** Create a new role */
	createUsersPermissionsRole?: ModelTypes["UsersPermissionsCreateRolePayload"] | undefined,
	/** Update an existing role */
	updateUsersPermissionsRole?: ModelTypes["UsersPermissionsUpdateRolePayload"] | undefined,
	/** Delete an existing role */
	deleteUsersPermissionsRole?: ModelTypes["UsersPermissionsDeleteRolePayload"] | undefined,
	/** Create a new user */
	createUsersPermissionsUser: ModelTypes["UsersPermissionsUserEntityResponse"],
	/** Update an existing user */
	updateUsersPermissionsUser: ModelTypes["UsersPermissionsUserEntityResponse"],
	/** Delete an existing user */
	deleteUsersPermissionsUser: ModelTypes["UsersPermissionsUserEntityResponse"],
	login: ModelTypes["UsersPermissionsLoginPayload"],
	/** Register a user */
	register: ModelTypes["UsersPermissionsLoginPayload"],
	/** Request a reset password token */
	forgotPassword?: ModelTypes["UsersPermissionsPasswordPayload"] | undefined,
	/** Reset user password. Confirm with a code (resetToken from forgotPassword) */
	resetPassword?: ModelTypes["UsersPermissionsLoginPayload"] | undefined,
	/** Change user password. Confirm with the current password. */
	changePassword?: ModelTypes["UsersPermissionsLoginPayload"] | undefined,
	/** Confirm an email users email address */
	emailConfirmation?: ModelTypes["UsersPermissionsLoginPayload"] | undefined
}
    }

export type GraphQLTypes = {
    /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
["JSON"]: "scalar" & { name: "JSON" };
	/** A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the `date-time` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar. */
["DateTime"]: "scalar" & { name: "DateTime" };
	/** The `Upload` scalar type represents a file upload. */
["Upload"]: "scalar" & { name: "Upload" };
	["Pagination"]: {
	__typename: "Pagination",
	total: number,
	page: number,
	pageSize: number,
	pageCount: number
};
	["ResponseCollectionMeta"]: {
	__typename: "ResponseCollectionMeta",
	pagination: GraphQLTypes["Pagination"]
};
	["PublicationState"]: PublicationState;
	["IDFilterInput"]: {
		and?: Array<string | undefined> | undefined,
	or?: Array<string | undefined> | undefined,
	not?: GraphQLTypes["IDFilterInput"] | undefined,
	eq?: string | undefined,
	eqi?: string | undefined,
	ne?: string | undefined,
	startsWith?: string | undefined,
	endsWith?: string | undefined,
	contains?: string | undefined,
	notContains?: string | undefined,
	containsi?: string | undefined,
	notContainsi?: string | undefined,
	gt?: string | undefined,
	gte?: string | undefined,
	lt?: string | undefined,
	lte?: string | undefined,
	null?: boolean | undefined,
	notNull?: boolean | undefined,
	in?: Array<string | undefined> | undefined,
	notIn?: Array<string | undefined> | undefined,
	between?: Array<string | undefined> | undefined
};
	["BooleanFilterInput"]: {
		and?: Array<boolean | undefined> | undefined,
	or?: Array<boolean | undefined> | undefined,
	not?: GraphQLTypes["BooleanFilterInput"] | undefined,
	eq?: boolean | undefined,
	eqi?: boolean | undefined,
	ne?: boolean | undefined,
	startsWith?: boolean | undefined,
	endsWith?: boolean | undefined,
	contains?: boolean | undefined,
	notContains?: boolean | undefined,
	containsi?: boolean | undefined,
	notContainsi?: boolean | undefined,
	gt?: boolean | undefined,
	gte?: boolean | undefined,
	lt?: boolean | undefined,
	lte?: boolean | undefined,
	null?: boolean | undefined,
	notNull?: boolean | undefined,
	in?: Array<boolean | undefined> | undefined,
	notIn?: Array<boolean | undefined> | undefined,
	between?: Array<boolean | undefined> | undefined
};
	["StringFilterInput"]: {
		and?: Array<string | undefined> | undefined,
	or?: Array<string | undefined> | undefined,
	not?: GraphQLTypes["StringFilterInput"] | undefined,
	eq?: string | undefined,
	eqi?: string | undefined,
	ne?: string | undefined,
	startsWith?: string | undefined,
	endsWith?: string | undefined,
	contains?: string | undefined,
	notContains?: string | undefined,
	containsi?: string | undefined,
	notContainsi?: string | undefined,
	gt?: string | undefined,
	gte?: string | undefined,
	lt?: string | undefined,
	lte?: string | undefined,
	null?: boolean | undefined,
	notNull?: boolean | undefined,
	in?: Array<string | undefined> | undefined,
	notIn?: Array<string | undefined> | undefined,
	between?: Array<string | undefined> | undefined
};
	["IntFilterInput"]: {
		and?: Array<number | undefined> | undefined,
	or?: Array<number | undefined> | undefined,
	not?: GraphQLTypes["IntFilterInput"] | undefined,
	eq?: number | undefined,
	eqi?: number | undefined,
	ne?: number | undefined,
	startsWith?: number | undefined,
	endsWith?: number | undefined,
	contains?: number | undefined,
	notContains?: number | undefined,
	containsi?: number | undefined,
	notContainsi?: number | undefined,
	gt?: number | undefined,
	gte?: number | undefined,
	lt?: number | undefined,
	lte?: number | undefined,
	null?: boolean | undefined,
	notNull?: boolean | undefined,
	in?: Array<number | undefined> | undefined,
	notIn?: Array<number | undefined> | undefined,
	between?: Array<number | undefined> | undefined
};
	["FloatFilterInput"]: {
		and?: Array<number | undefined> | undefined,
	or?: Array<number | undefined> | undefined,
	not?: GraphQLTypes["FloatFilterInput"] | undefined,
	eq?: number | undefined,
	eqi?: number | undefined,
	ne?: number | undefined,
	startsWith?: number | undefined,
	endsWith?: number | undefined,
	contains?: number | undefined,
	notContains?: number | undefined,
	containsi?: number | undefined,
	notContainsi?: number | undefined,
	gt?: number | undefined,
	gte?: number | undefined,
	lt?: number | undefined,
	lte?: number | undefined,
	null?: boolean | undefined,
	notNull?: boolean | undefined,
	in?: Array<number | undefined> | undefined,
	notIn?: Array<number | undefined> | undefined,
	between?: Array<number | undefined> | undefined
};
	["DateTimeFilterInput"]: {
		and?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	or?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	not?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	eq?: GraphQLTypes["DateTime"] | undefined,
	eqi?: GraphQLTypes["DateTime"] | undefined,
	ne?: GraphQLTypes["DateTime"] | undefined,
	startsWith?: GraphQLTypes["DateTime"] | undefined,
	endsWith?: GraphQLTypes["DateTime"] | undefined,
	contains?: GraphQLTypes["DateTime"] | undefined,
	notContains?: GraphQLTypes["DateTime"] | undefined,
	containsi?: GraphQLTypes["DateTime"] | undefined,
	notContainsi?: GraphQLTypes["DateTime"] | undefined,
	gt?: GraphQLTypes["DateTime"] | undefined,
	gte?: GraphQLTypes["DateTime"] | undefined,
	lt?: GraphQLTypes["DateTime"] | undefined,
	lte?: GraphQLTypes["DateTime"] | undefined,
	null?: boolean | undefined,
	notNull?: boolean | undefined,
	in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	notIn?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	between?: Array<GraphQLTypes["DateTime"] | undefined> | undefined
};
	["JSONFilterInput"]: {
		and?: Array<GraphQLTypes["JSON"] | undefined> | undefined,
	or?: Array<GraphQLTypes["JSON"] | undefined> | undefined,
	not?: GraphQLTypes["JSONFilterInput"] | undefined,
	eq?: GraphQLTypes["JSON"] | undefined,
	eqi?: GraphQLTypes["JSON"] | undefined,
	ne?: GraphQLTypes["JSON"] | undefined,
	startsWith?: GraphQLTypes["JSON"] | undefined,
	endsWith?: GraphQLTypes["JSON"] | undefined,
	contains?: GraphQLTypes["JSON"] | undefined,
	notContains?: GraphQLTypes["JSON"] | undefined,
	containsi?: GraphQLTypes["JSON"] | undefined,
	notContainsi?: GraphQLTypes["JSON"] | undefined,
	gt?: GraphQLTypes["JSON"] | undefined,
	gte?: GraphQLTypes["JSON"] | undefined,
	lt?: GraphQLTypes["JSON"] | undefined,
	lte?: GraphQLTypes["JSON"] | undefined,
	null?: boolean | undefined,
	notNull?: boolean | undefined,
	in?: Array<GraphQLTypes["JSON"] | undefined> | undefined,
	notIn?: Array<GraphQLTypes["JSON"] | undefined> | undefined,
	between?: Array<GraphQLTypes["JSON"] | undefined> | undefined
};
	["UploadFileFiltersInput"]: {
		id?: GraphQLTypes["IDFilterInput"] | undefined,
	name?: GraphQLTypes["StringFilterInput"] | undefined,
	alternativeText?: GraphQLTypes["StringFilterInput"] | undefined,
	caption?: GraphQLTypes["StringFilterInput"] | undefined,
	width?: GraphQLTypes["IntFilterInput"] | undefined,
	height?: GraphQLTypes["IntFilterInput"] | undefined,
	formats?: GraphQLTypes["JSONFilterInput"] | undefined,
	hash?: GraphQLTypes["StringFilterInput"] | undefined,
	ext?: GraphQLTypes["StringFilterInput"] | undefined,
	mime?: GraphQLTypes["StringFilterInput"] | undefined,
	size?: GraphQLTypes["FloatFilterInput"] | undefined,
	url?: GraphQLTypes["StringFilterInput"] | undefined,
	previewUrl?: GraphQLTypes["StringFilterInput"] | undefined,
	provider?: GraphQLTypes["StringFilterInput"] | undefined,
	provider_metadata?: GraphQLTypes["JSONFilterInput"] | undefined,
	folder?: GraphQLTypes["UploadFolderFiltersInput"] | undefined,
	folderPath?: GraphQLTypes["StringFilterInput"] | undefined,
	createdAt?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	updatedAt?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	and?: Array<GraphQLTypes["UploadFileFiltersInput"] | undefined> | undefined,
	or?: Array<GraphQLTypes["UploadFileFiltersInput"] | undefined> | undefined,
	not?: GraphQLTypes["UploadFileFiltersInput"] | undefined
};
	["UploadFileInput"]: {
		name?: string | undefined,
	alternativeText?: string | undefined,
	caption?: string | undefined,
	width?: number | undefined,
	height?: number | undefined,
	formats?: GraphQLTypes["JSON"] | undefined,
	hash?: string | undefined,
	ext?: string | undefined,
	mime?: string | undefined,
	size?: number | undefined,
	url?: string | undefined,
	previewUrl?: string | undefined,
	provider?: string | undefined,
	provider_metadata?: GraphQLTypes["JSON"] | undefined,
	folder?: string | undefined,
	folderPath?: string | undefined
};
	["UploadFile"]: {
	__typename: "UploadFile",
	name: string,
	alternativeText?: string | undefined,
	caption?: string | undefined,
	width?: number | undefined,
	height?: number | undefined,
	formats?: GraphQLTypes["JSON"] | undefined,
	hash: string,
	ext?: string | undefined,
	mime: string,
	size: number,
	url: string,
	previewUrl?: string | undefined,
	provider: string,
	provider_metadata?: GraphQLTypes["JSON"] | undefined,
	related?: Array<GraphQLTypes["GenericMorph"] | undefined> | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined
};
	["UploadFileEntity"]: {
	__typename: "UploadFileEntity",
	id?: string | undefined,
	attributes?: GraphQLTypes["UploadFile"] | undefined
};
	["UploadFileEntityResponse"]: {
	__typename: "UploadFileEntityResponse",
	data?: GraphQLTypes["UploadFileEntity"] | undefined
};
	["UploadFileEntityResponseCollection"]: {
	__typename: "UploadFileEntityResponseCollection",
	data: Array<GraphQLTypes["UploadFileEntity"]>,
	meta: GraphQLTypes["ResponseCollectionMeta"]
};
	["UploadFileRelationResponseCollection"]: {
	__typename: "UploadFileRelationResponseCollection",
	data: Array<GraphQLTypes["UploadFileEntity"]>
};
	["UploadFolderFiltersInput"]: {
		id?: GraphQLTypes["IDFilterInput"] | undefined,
	name?: GraphQLTypes["StringFilterInput"] | undefined,
	pathId?: GraphQLTypes["IntFilterInput"] | undefined,
	parent?: GraphQLTypes["UploadFolderFiltersInput"] | undefined,
	children?: GraphQLTypes["UploadFolderFiltersInput"] | undefined,
	files?: GraphQLTypes["UploadFileFiltersInput"] | undefined,
	path?: GraphQLTypes["StringFilterInput"] | undefined,
	createdAt?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	updatedAt?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	and?: Array<GraphQLTypes["UploadFolderFiltersInput"] | undefined> | undefined,
	or?: Array<GraphQLTypes["UploadFolderFiltersInput"] | undefined> | undefined,
	not?: GraphQLTypes["UploadFolderFiltersInput"] | undefined
};
	["UploadFolderInput"]: {
		name?: string | undefined,
	pathId?: number | undefined,
	parent?: string | undefined,
	children?: Array<string | undefined> | undefined,
	files?: Array<string | undefined> | undefined,
	path?: string | undefined
};
	["UploadFolder"]: {
	__typename: "UploadFolder",
	name: string,
	pathId: number,
	parent?: GraphQLTypes["UploadFolderEntityResponse"] | undefined,
	children?: GraphQLTypes["UploadFolderRelationResponseCollection"] | undefined,
	files?: GraphQLTypes["UploadFileRelationResponseCollection"] | undefined,
	path: string,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined
};
	["UploadFolderEntity"]: {
	__typename: "UploadFolderEntity",
	id?: string | undefined,
	attributes?: GraphQLTypes["UploadFolder"] | undefined
};
	["UploadFolderEntityResponse"]: {
	__typename: "UploadFolderEntityResponse",
	data?: GraphQLTypes["UploadFolderEntity"] | undefined
};
	["UploadFolderEntityResponseCollection"]: {
	__typename: "UploadFolderEntityResponseCollection",
	data: Array<GraphQLTypes["UploadFolderEntity"]>,
	meta: GraphQLTypes["ResponseCollectionMeta"]
};
	["UploadFolderRelationResponseCollection"]: {
	__typename: "UploadFolderRelationResponseCollection",
	data: Array<GraphQLTypes["UploadFolderEntity"]>
};
	["I18NLocaleFiltersInput"]: {
		id?: GraphQLTypes["IDFilterInput"] | undefined,
	name?: GraphQLTypes["StringFilterInput"] | undefined,
	code?: GraphQLTypes["StringFilterInput"] | undefined,
	createdAt?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	updatedAt?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	and?: Array<GraphQLTypes["I18NLocaleFiltersInput"] | undefined> | undefined,
	or?: Array<GraphQLTypes["I18NLocaleFiltersInput"] | undefined> | undefined,
	not?: GraphQLTypes["I18NLocaleFiltersInput"] | undefined
};
	["I18NLocale"]: {
	__typename: "I18NLocale",
	name?: string | undefined,
	code?: string | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined
};
	["I18NLocaleEntity"]: {
	__typename: "I18NLocaleEntity",
	id?: string | undefined,
	attributes?: GraphQLTypes["I18NLocale"] | undefined
};
	["I18NLocaleEntityResponse"]: {
	__typename: "I18NLocaleEntityResponse",
	data?: GraphQLTypes["I18NLocaleEntity"] | undefined
};
	["I18NLocaleEntityResponseCollection"]: {
	__typename: "I18NLocaleEntityResponseCollection",
	data: Array<GraphQLTypes["I18NLocaleEntity"]>,
	meta: GraphQLTypes["ResponseCollectionMeta"]
};
	["UsersPermissionsPermissionFiltersInput"]: {
		id?: GraphQLTypes["IDFilterInput"] | undefined,
	action?: GraphQLTypes["StringFilterInput"] | undefined,
	role?: GraphQLTypes["UsersPermissionsRoleFiltersInput"] | undefined,
	createdAt?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	updatedAt?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	and?: Array<GraphQLTypes["UsersPermissionsPermissionFiltersInput"] | undefined> | undefined,
	or?: Array<GraphQLTypes["UsersPermissionsPermissionFiltersInput"] | undefined> | undefined,
	not?: GraphQLTypes["UsersPermissionsPermissionFiltersInput"] | undefined
};
	["UsersPermissionsPermission"]: {
	__typename: "UsersPermissionsPermission",
	action: string,
	role?: GraphQLTypes["UsersPermissionsRoleEntityResponse"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined
};
	["UsersPermissionsPermissionEntity"]: {
	__typename: "UsersPermissionsPermissionEntity",
	id?: string | undefined,
	attributes?: GraphQLTypes["UsersPermissionsPermission"] | undefined
};
	["UsersPermissionsPermissionRelationResponseCollection"]: {
	__typename: "UsersPermissionsPermissionRelationResponseCollection",
	data: Array<GraphQLTypes["UsersPermissionsPermissionEntity"]>
};
	["UsersPermissionsRoleFiltersInput"]: {
		id?: GraphQLTypes["IDFilterInput"] | undefined,
	name?: GraphQLTypes["StringFilterInput"] | undefined,
	description?: GraphQLTypes["StringFilterInput"] | undefined,
	type?: GraphQLTypes["StringFilterInput"] | undefined,
	permissions?: GraphQLTypes["UsersPermissionsPermissionFiltersInput"] | undefined,
	users?: GraphQLTypes["UsersPermissionsUserFiltersInput"] | undefined,
	createdAt?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	updatedAt?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	and?: Array<GraphQLTypes["UsersPermissionsRoleFiltersInput"] | undefined> | undefined,
	or?: Array<GraphQLTypes["UsersPermissionsRoleFiltersInput"] | undefined> | undefined,
	not?: GraphQLTypes["UsersPermissionsRoleFiltersInput"] | undefined
};
	["UsersPermissionsRoleInput"]: {
		name?: string | undefined,
	description?: string | undefined,
	type?: string | undefined,
	permissions?: Array<string | undefined> | undefined,
	users?: Array<string | undefined> | undefined
};
	["UsersPermissionsRole"]: {
	__typename: "UsersPermissionsRole",
	name: string,
	description?: string | undefined,
	type?: string | undefined,
	permissions?: GraphQLTypes["UsersPermissionsPermissionRelationResponseCollection"] | undefined,
	users?: GraphQLTypes["UsersPermissionsUserRelationResponseCollection"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined
};
	["UsersPermissionsRoleEntity"]: {
	__typename: "UsersPermissionsRoleEntity",
	id?: string | undefined,
	attributes?: GraphQLTypes["UsersPermissionsRole"] | undefined
};
	["UsersPermissionsRoleEntityResponse"]: {
	__typename: "UsersPermissionsRoleEntityResponse",
	data?: GraphQLTypes["UsersPermissionsRoleEntity"] | undefined
};
	["UsersPermissionsRoleEntityResponseCollection"]: {
	__typename: "UsersPermissionsRoleEntityResponseCollection",
	data: Array<GraphQLTypes["UsersPermissionsRoleEntity"]>,
	meta: GraphQLTypes["ResponseCollectionMeta"]
};
	["UsersPermissionsUserFiltersInput"]: {
		id?: GraphQLTypes["IDFilterInput"] | undefined,
	username?: GraphQLTypes["StringFilterInput"] | undefined,
	email?: GraphQLTypes["StringFilterInput"] | undefined,
	provider?: GraphQLTypes["StringFilterInput"] | undefined,
	password?: GraphQLTypes["StringFilterInput"] | undefined,
	resetPasswordToken?: GraphQLTypes["StringFilterInput"] | undefined,
	confirmationToken?: GraphQLTypes["StringFilterInput"] | undefined,
	confirmed?: GraphQLTypes["BooleanFilterInput"] | undefined,
	blocked?: GraphQLTypes["BooleanFilterInput"] | undefined,
	role?: GraphQLTypes["UsersPermissionsRoleFiltersInput"] | undefined,
	createdAt?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	updatedAt?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	and?: Array<GraphQLTypes["UsersPermissionsUserFiltersInput"] | undefined> | undefined,
	or?: Array<GraphQLTypes["UsersPermissionsUserFiltersInput"] | undefined> | undefined,
	not?: GraphQLTypes["UsersPermissionsUserFiltersInput"] | undefined
};
	["UsersPermissionsUserInput"]: {
		username?: string | undefined,
	email?: string | undefined,
	provider?: string | undefined,
	password?: string | undefined,
	resetPasswordToken?: string | undefined,
	confirmationToken?: string | undefined,
	confirmed?: boolean | undefined,
	blocked?: boolean | undefined,
	role?: string | undefined
};
	["UsersPermissionsUser"]: {
	__typename: "UsersPermissionsUser",
	username: string,
	email: string,
	provider?: string | undefined,
	confirmed?: boolean | undefined,
	blocked?: boolean | undefined,
	role?: GraphQLTypes["UsersPermissionsRoleEntityResponse"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined
};
	["UsersPermissionsUserEntity"]: {
	__typename: "UsersPermissionsUserEntity",
	id?: string | undefined,
	attributes?: GraphQLTypes["UsersPermissionsUser"] | undefined
};
	["UsersPermissionsUserEntityResponse"]: {
	__typename: "UsersPermissionsUserEntityResponse",
	data?: GraphQLTypes["UsersPermissionsUserEntity"] | undefined
};
	["UsersPermissionsUserEntityResponseCollection"]: {
	__typename: "UsersPermissionsUserEntityResponseCollection",
	data: Array<GraphQLTypes["UsersPermissionsUserEntity"]>,
	meta: GraphQLTypes["ResponseCollectionMeta"]
};
	["UsersPermissionsUserRelationResponseCollection"]: {
	__typename: "UsersPermissionsUserRelationResponseCollection",
	data: Array<GraphQLTypes["UsersPermissionsUserEntity"]>
};
	["MunicipalityFiltersInput"]: {
		id?: GraphQLTypes["IDFilterInput"] | undefined,
	Title?: GraphQLTypes["StringFilterInput"] | undefined,
	createdAt?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	updatedAt?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	publishedAt?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	and?: Array<GraphQLTypes["MunicipalityFiltersInput"] | undefined> | undefined,
	or?: Array<GraphQLTypes["MunicipalityFiltersInput"] | undefined> | undefined,
	not?: GraphQLTypes["MunicipalityFiltersInput"] | undefined
};
	["MunicipalityInput"]: {
		Title?: string | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined
};
	["Municipality"]: {
	__typename: "Municipality",
	Title?: string | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined
};
	["MunicipalityEntity"]: {
	__typename: "MunicipalityEntity",
	id?: string | undefined,
	attributes?: GraphQLTypes["Municipality"] | undefined
};
	["MunicipalityEntityResponse"]: {
	__typename: "MunicipalityEntityResponse",
	data?: GraphQLTypes["MunicipalityEntity"] | undefined
};
	["MunicipalityEntityResponseCollection"]: {
	__typename: "MunicipalityEntityResponseCollection",
	data: Array<GraphQLTypes["MunicipalityEntity"]>,
	meta: GraphQLTypes["ResponseCollectionMeta"]
};
	["MunicipalityRelationResponseCollection"]: {
	__typename: "MunicipalityRelationResponseCollection",
	data: Array<GraphQLTypes["MunicipalityEntity"]>
};
	["ProviderFiltersInput"]: {
		id?: GraphQLTypes["IDFilterInput"] | undefined,
	Title?: GraphQLTypes["StringFilterInput"] | undefined,
	services?: GraphQLTypes["ServiceFiltersInput"] | undefined,
	municipalities?: GraphQLTypes["MunicipalityFiltersInput"] | undefined,
	createdAt?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	updatedAt?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	publishedAt?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	and?: Array<GraphQLTypes["ProviderFiltersInput"] | undefined> | undefined,
	or?: Array<GraphQLTypes["ProviderFiltersInput"] | undefined> | undefined,
	not?: GraphQLTypes["ProviderFiltersInput"] | undefined
};
	["ProviderInput"]: {
		Title?: string | undefined,
	services?: Array<string | undefined> | undefined,
	municipalities?: Array<string | undefined> | undefined,
	logo?: string | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined
};
	["Provider"]: {
	__typename: "Provider",
	Title?: string | undefined,
	services?: GraphQLTypes["ServiceRelationResponseCollection"] | undefined,
	municipalities?: GraphQLTypes["MunicipalityRelationResponseCollection"] | undefined,
	logo?: GraphQLTypes["UploadFileEntityResponse"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined
};
	["ProviderEntity"]: {
	__typename: "ProviderEntity",
	id?: string | undefined,
	attributes?: GraphQLTypes["Provider"] | undefined
};
	["ProviderEntityResponse"]: {
	__typename: "ProviderEntityResponse",
	data?: GraphQLTypes["ProviderEntity"] | undefined
};
	["ProviderEntityResponseCollection"]: {
	__typename: "ProviderEntityResponseCollection",
	data: Array<GraphQLTypes["ProviderEntity"]>,
	meta: GraphQLTypes["ResponseCollectionMeta"]
};
	["ServiceFiltersInput"]: {
		id?: GraphQLTypes["IDFilterInput"] | undefined,
	Title?: GraphQLTypes["StringFilterInput"] | undefined,
	createdAt?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	updatedAt?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	publishedAt?: GraphQLTypes["DateTimeFilterInput"] | undefined,
	and?: Array<GraphQLTypes["ServiceFiltersInput"] | undefined> | undefined,
	or?: Array<GraphQLTypes["ServiceFiltersInput"] | undefined> | undefined,
	not?: GraphQLTypes["ServiceFiltersInput"] | undefined
};
	["ServiceInput"]: {
		Title?: string | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined
};
	["Service"]: {
	__typename: "Service",
	Title?: string | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined
};
	["ServiceEntity"]: {
	__typename: "ServiceEntity",
	id?: string | undefined,
	attributes?: GraphQLTypes["Service"] | undefined
};
	["ServiceEntityResponse"]: {
	__typename: "ServiceEntityResponse",
	data?: GraphQLTypes["ServiceEntity"] | undefined
};
	["ServiceEntityResponseCollection"]: {
	__typename: "ServiceEntityResponseCollection",
	data: Array<GraphQLTypes["ServiceEntity"]>,
	meta: GraphQLTypes["ResponseCollectionMeta"]
};
	["ServiceRelationResponseCollection"]: {
	__typename: "ServiceRelationResponseCollection",
	data: Array<GraphQLTypes["ServiceEntity"]>
};
	["GenericMorph"]:{
        	__typename:"UploadFile" | "UploadFolder" | "I18NLocale" | "UsersPermissionsPermission" | "UsersPermissionsRole" | "UsersPermissionsUser" | "Municipality" | "Provider" | "Service"
        	['...on UploadFile']: '__union' & GraphQLTypes["UploadFile"];
	['...on UploadFolder']: '__union' & GraphQLTypes["UploadFolder"];
	['...on I18NLocale']: '__union' & GraphQLTypes["I18NLocale"];
	['...on UsersPermissionsPermission']: '__union' & GraphQLTypes["UsersPermissionsPermission"];
	['...on UsersPermissionsRole']: '__union' & GraphQLTypes["UsersPermissionsRole"];
	['...on UsersPermissionsUser']: '__union' & GraphQLTypes["UsersPermissionsUser"];
	['...on Municipality']: '__union' & GraphQLTypes["Municipality"];
	['...on Provider']: '__union' & GraphQLTypes["Provider"];
	['...on Service']: '__union' & GraphQLTypes["Service"];
};
	["FileInfoInput"]: {
		name?: string | undefined,
	alternativeText?: string | undefined,
	caption?: string | undefined
};
	["UsersPermissionsMe"]: {
	__typename: "UsersPermissionsMe",
	id: string,
	username: string,
	email?: string | undefined,
	confirmed?: boolean | undefined,
	blocked?: boolean | undefined,
	role?: GraphQLTypes["UsersPermissionsMeRole"] | undefined
};
	["UsersPermissionsMeRole"]: {
	__typename: "UsersPermissionsMeRole",
	id: string,
	name: string,
	description?: string | undefined,
	type?: string | undefined
};
	["UsersPermissionsRegisterInput"]: {
		username: string,
	email: string,
	password: string
};
	["UsersPermissionsLoginInput"]: {
		identifier: string,
	password: string,
	provider: string
};
	["UsersPermissionsPasswordPayload"]: {
	__typename: "UsersPermissionsPasswordPayload",
	ok: boolean
};
	["UsersPermissionsLoginPayload"]: {
	__typename: "UsersPermissionsLoginPayload",
	jwt?: string | undefined,
	user: GraphQLTypes["UsersPermissionsMe"]
};
	["UsersPermissionsCreateRolePayload"]: {
	__typename: "UsersPermissionsCreateRolePayload",
	ok: boolean
};
	["UsersPermissionsUpdateRolePayload"]: {
	__typename: "UsersPermissionsUpdateRolePayload",
	ok: boolean
};
	["UsersPermissionsDeleteRolePayload"]: {
	__typename: "UsersPermissionsDeleteRolePayload",
	ok: boolean
};
	["PaginationArg"]: {
		page?: number | undefined,
	pageSize?: number | undefined,
	start?: number | undefined,
	limit?: number | undefined
};
	["Query"]: {
	__typename: "Query",
	uploadFile?: GraphQLTypes["UploadFileEntityResponse"] | undefined,
	uploadFiles?: GraphQLTypes["UploadFileEntityResponseCollection"] | undefined,
	uploadFolder?: GraphQLTypes["UploadFolderEntityResponse"] | undefined,
	uploadFolders?: GraphQLTypes["UploadFolderEntityResponseCollection"] | undefined,
	i18NLocale?: GraphQLTypes["I18NLocaleEntityResponse"] | undefined,
	i18NLocales?: GraphQLTypes["I18NLocaleEntityResponseCollection"] | undefined,
	usersPermissionsRole?: GraphQLTypes["UsersPermissionsRoleEntityResponse"] | undefined,
	usersPermissionsRoles?: GraphQLTypes["UsersPermissionsRoleEntityResponseCollection"] | undefined,
	usersPermissionsUser?: GraphQLTypes["UsersPermissionsUserEntityResponse"] | undefined,
	usersPermissionsUsers?: GraphQLTypes["UsersPermissionsUserEntityResponseCollection"] | undefined,
	municipality?: GraphQLTypes["MunicipalityEntityResponse"] | undefined,
	municipalities?: GraphQLTypes["MunicipalityEntityResponseCollection"] | undefined,
	provider?: GraphQLTypes["ProviderEntityResponse"] | undefined,
	providers?: GraphQLTypes["ProviderEntityResponseCollection"] | undefined,
	service?: GraphQLTypes["ServiceEntityResponse"] | undefined,
	services?: GraphQLTypes["ServiceEntityResponseCollection"] | undefined,
	me?: GraphQLTypes["UsersPermissionsMe"] | undefined
};
	["Mutation"]: {
	__typename: "Mutation",
	createUploadFile?: GraphQLTypes["UploadFileEntityResponse"] | undefined,
	updateUploadFile?: GraphQLTypes["UploadFileEntityResponse"] | undefined,
	deleteUploadFile?: GraphQLTypes["UploadFileEntityResponse"] | undefined,
	createUploadFolder?: GraphQLTypes["UploadFolderEntityResponse"] | undefined,
	updateUploadFolder?: GraphQLTypes["UploadFolderEntityResponse"] | undefined,
	deleteUploadFolder?: GraphQLTypes["UploadFolderEntityResponse"] | undefined,
	createMunicipality?: GraphQLTypes["MunicipalityEntityResponse"] | undefined,
	updateMunicipality?: GraphQLTypes["MunicipalityEntityResponse"] | undefined,
	deleteMunicipality?: GraphQLTypes["MunicipalityEntityResponse"] | undefined,
	createProvider?: GraphQLTypes["ProviderEntityResponse"] | undefined,
	updateProvider?: GraphQLTypes["ProviderEntityResponse"] | undefined,
	deleteProvider?: GraphQLTypes["ProviderEntityResponse"] | undefined,
	createService?: GraphQLTypes["ServiceEntityResponse"] | undefined,
	updateService?: GraphQLTypes["ServiceEntityResponse"] | undefined,
	deleteService?: GraphQLTypes["ServiceEntityResponse"] | undefined,
	upload: GraphQLTypes["UploadFileEntityResponse"],
	multipleUpload: Array<GraphQLTypes["UploadFileEntityResponse"] | undefined>,
	updateFileInfo: GraphQLTypes["UploadFileEntityResponse"],
	removeFile?: GraphQLTypes["UploadFileEntityResponse"] | undefined,
	/** Create a new role */
	createUsersPermissionsRole?: GraphQLTypes["UsersPermissionsCreateRolePayload"] | undefined,
	/** Update an existing role */
	updateUsersPermissionsRole?: GraphQLTypes["UsersPermissionsUpdateRolePayload"] | undefined,
	/** Delete an existing role */
	deleteUsersPermissionsRole?: GraphQLTypes["UsersPermissionsDeleteRolePayload"] | undefined,
	/** Create a new user */
	createUsersPermissionsUser: GraphQLTypes["UsersPermissionsUserEntityResponse"],
	/** Update an existing user */
	updateUsersPermissionsUser: GraphQLTypes["UsersPermissionsUserEntityResponse"],
	/** Delete an existing user */
	deleteUsersPermissionsUser: GraphQLTypes["UsersPermissionsUserEntityResponse"],
	login: GraphQLTypes["UsersPermissionsLoginPayload"],
	/** Register a user */
	register: GraphQLTypes["UsersPermissionsLoginPayload"],
	/** Request a reset password token */
	forgotPassword?: GraphQLTypes["UsersPermissionsPasswordPayload"] | undefined,
	/** Reset user password. Confirm with a code (resetToken from forgotPassword) */
	resetPassword?: GraphQLTypes["UsersPermissionsLoginPayload"] | undefined,
	/** Change user password. Confirm with the current password. */
	changePassword?: GraphQLTypes["UsersPermissionsLoginPayload"] | undefined,
	/** Confirm an email users email address */
	emailConfirmation?: GraphQLTypes["UsersPermissionsLoginPayload"] | undefined
}
    }
export const enum PublicationState {
	LIVE = "LIVE",
	PREVIEW = "PREVIEW"
}

type ZEUS_VARIABLES = {
	["JSON"]: ValueTypes["JSON"];
	["DateTime"]: ValueTypes["DateTime"];
	["Upload"]: ValueTypes["Upload"];
	["PublicationState"]: ValueTypes["PublicationState"];
	["IDFilterInput"]: ValueTypes["IDFilterInput"];
	["BooleanFilterInput"]: ValueTypes["BooleanFilterInput"];
	["StringFilterInput"]: ValueTypes["StringFilterInput"];
	["IntFilterInput"]: ValueTypes["IntFilterInput"];
	["FloatFilterInput"]: ValueTypes["FloatFilterInput"];
	["DateTimeFilterInput"]: ValueTypes["DateTimeFilterInput"];
	["JSONFilterInput"]: ValueTypes["JSONFilterInput"];
	["UploadFileFiltersInput"]: ValueTypes["UploadFileFiltersInput"];
	["UploadFileInput"]: ValueTypes["UploadFileInput"];
	["UploadFolderFiltersInput"]: ValueTypes["UploadFolderFiltersInput"];
	["UploadFolderInput"]: ValueTypes["UploadFolderInput"];
	["I18NLocaleFiltersInput"]: ValueTypes["I18NLocaleFiltersInput"];
	["UsersPermissionsPermissionFiltersInput"]: ValueTypes["UsersPermissionsPermissionFiltersInput"];
	["UsersPermissionsRoleFiltersInput"]: ValueTypes["UsersPermissionsRoleFiltersInput"];
	["UsersPermissionsRoleInput"]: ValueTypes["UsersPermissionsRoleInput"];
	["UsersPermissionsUserFiltersInput"]: ValueTypes["UsersPermissionsUserFiltersInput"];
	["UsersPermissionsUserInput"]: ValueTypes["UsersPermissionsUserInput"];
	["MunicipalityFiltersInput"]: ValueTypes["MunicipalityFiltersInput"];
	["MunicipalityInput"]: ValueTypes["MunicipalityInput"];
	["ProviderFiltersInput"]: ValueTypes["ProviderFiltersInput"];
	["ProviderInput"]: ValueTypes["ProviderInput"];
	["ServiceFiltersInput"]: ValueTypes["ServiceFiltersInput"];
	["ServiceInput"]: ValueTypes["ServiceInput"];
	["FileInfoInput"]: ValueTypes["FileInfoInput"];
	["UsersPermissionsRegisterInput"]: ValueTypes["UsersPermissionsRegisterInput"];
	["UsersPermissionsLoginInput"]: ValueTypes["UsersPermissionsLoginInput"];
	["PaginationArg"]: ValueTypes["PaginationArg"];
}