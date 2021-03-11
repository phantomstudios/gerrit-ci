# Gerrit CI
A CI solution for Gerrit projects.

Runs a list of commands against Gerrit reviews and it sends back the response as comment and vote (+1/-1). It authenticates as the user running the command.

## Installation
```
npm install @phantom/gerrit-ci
```

## Initial setup
The actual project setup is not handled by the CI which expects the project to already be initialised.
By default, the CI expects the project to be in the `./repo` folder ready to build. The path is configurable (please see the `repositoryPath` option).


This means that initially you will need to `git clone` or copy your project folder into the `./repo` folder and run all the command needed to install its requirements to run (e.g. `npm install`  and co).

<u>Once the project is set, you are ready to go!</u>

### Example of a CI project structure

```
- project_ci/
    |-- node_modules/
    |-- repo/
    | index.ts
    | package.json
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

## Running on a CronJob using PM2
### Install PM2
Documentation  https://pm2.keymetrics.io/docs/usage/quick-start/#installation
```bash
$ npm install pm2@latest -g
```
### Run the cronjob with the following configuration
Ecosystem Documentation https://pm2.keymetrics.io/docs/usage/application-declaration/

```bash
$ pm2 start ecosystem.config.json
```
```json
// ecosystem.config.json
{
  "apps": [
    {
      "script": "./index.ts",
      "name": "foo-gerrit-ci",
      "cwd": "/Users/alex/projects/foo-gerrit-ci/",
      // @see https://crontab.guru/#*/5_*_*_*_*
      "cron_restart": "*/5 * * * *",
      // Add timestamp to logs
      "time": true,
      // Do not restart once the execution ends
      "autorestart": false
    }
  ]
}
```

### Observe logs
Documentation https://pm2.keymetrics.io/docs/usage/log-management/
```bash
# Display only `foo-gerrit-ci` application logs
pm2 logs foo-gerrit-ci
```
# Configuration

| Property      | Description |
| ------------- | ----------- |
| dryRun        | Prints the results without sending comments to Gerrit (default = false)      |
| filterBranch     | The regular expression the CI will use to filter the branches. If `targetBranch`  is specified, this is ignored. |
| pipeline | List of commands to execute against a change |
| repositoryUrl | The URL to the Gerrit repository |
| repositoryPath | Optional. The path where the repository is stored on the local machine ()default = ./repo |
| sizeList | The number of open CRs to pull from Gerrit (default = 25) |
| targetBranch | The branch to run the CI against. This takes priority over `filterBranch`, so the latter will be ignored. |
|||

<br>

### Targeting multiple branches
Use the `filterBranch` option to target multiple branches. This is the regular
expression used to match which branches we need to check. If the `targetBranch` is set, this config is ignored.

```typescript
{
  // Run against every branch starting with "phantom-"
  filterBranch: /^phantom-*/g,
}
```

# Pipeline
The list of commands to run against a CR. This could either be the command as a string (`pipeline: ['npm run build']`) or a `TaskObject` where the output could be controlled.
## TaskObject Spec
| Property | Description |
| -------- | ----------- |
| command  | The command as a string. e.g. `'npm run build'` |
| successMessage  | The success message as string or a function `(output: string) => string` |
| errorMessage  | The error message as string or a function `(output: string) => string` |
|||

### Use custom response messages

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

