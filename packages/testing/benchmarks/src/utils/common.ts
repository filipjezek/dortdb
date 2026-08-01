import { createCustomEqual, type EqualityComparator } from 'fast-equals';

const rtol = 1e-9;
const atol = 1e-9;

function createAreNumbersEqual(
  areNumbersEqual: EqualityComparator<any>,
): EqualityComparator<any> {
  return function (a, b, state) {
    if (!isNaN(a) && !isNaN(b)) {
      if (a % 1 !== 0 || b % 1 !== 0) {
        // Compare numbers with a tolerance to account for floating point precision issues
        const res = Math.abs(a - b) <= atol + rtol * Math.max(Math.abs(a), Math.abs(b));
        // if (!res) {
        //   console.error(
        //     `Numbers ${a} and ${b} differ more than the allowed tolerance.`,
        //   );
        // }
        return res;
      }
    }
    return areNumbersEqual(a, b, state);
  };
}

export const deepEqual = createCustomEqual({
  createCustomConfig: ({ areNumbersEqual }) => ({
    areNumbersEqual: createAreNumbersEqual(areNumbersEqual),
  }),
});

export function promiseTimeout(ms = 0): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function pickRandom<T>(array: T[]): T {
  // There is no way to set seed in JS. We would have to use a custom library.
  // Let's just believe there is too few values in the array (and too many queries) to make this a problem.
  return array[~~(Math.random() * array.length)];
}

type ConnectionCredentials = {
  username: string;
  password?: string;
  host: string;
  port: number;
  database: string;
};

// A workaround for the fact that we have to pass the credentials to the databases and we just really don't want to complicate the CLI with a shit ton of options.
// It doesn't help that OrientDB and ArangoDB don't support connection strings, but we can define our own format!
const CONNECTION_STRING_REGEX = /^(?<protocol>[^:]+):\/\/(?<username>[^:]+)(?::(?<password>[^@]+))?@(?<host>[^:]+):(?<port>\d+)\/(?<database>.+)$/;

export function parseConnectionString(connectionString: string, databaseProtocol: string): ConnectionCredentials {
  const match = connectionString.match(CONNECTION_STRING_REGEX);
  if (!match || !match.groups)
    throw new Error(`Invalid connection string: ${connectionString}`);

  const { protocol, username, password, host, port, database } = match.groups;

  if (protocol !== databaseProtocol)
    throw new Error(`Invalid protocol in connection string: ${protocol}. Expected: ${databaseProtocol}`);

  return { username, password, host, port: parseInt(port, 10), database };
}
