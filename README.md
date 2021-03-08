# Gerrit CI
A CI solution for Gerrit projects.

Runs a list of commands against Gerrit reviews and it sends back the response as comment and vote (+1/-1). It authenticates as the user running the command.

## Installation
```
npm install @phantom/gerrit-ci
```

## Usage
```bash
$ ts-node index.ts
```
```typescript
// index.ts
import {GerritCI} from '@phantom/gerrit-ci';

const gerritCI = new GerritCI({
  repositoryUrl: 'https://android.googlesource.com/kernel/common/',
  targetBranch: 'master',

  pipeline: ['npm run build', 'npm test'],
});

gerritCI.run();
```

### Targeting multiple branches
Use the `filterBranch` option to target multiple branches. This is the regular
expression used to match which branches we need to check. If the `targetBranch` is set, this config is ignored.

```typescript
{
  // Run against every branch starting with "phantom-"
  filterBranch: /^phantom-*/g,
}
```

### Custom response messages

```typescript
{
  pipeline: [
    {
      command: 'npm run build',
      successMessage: 'Yay! Build completed',
      errorMessage: (commandOutput: string) => {
        const totalErrors = extractNumberOfErrors(commandOutput);

        return `The build failed. There are ${totalErrors} error(s)`;
      },
    }
  ],
}
```

