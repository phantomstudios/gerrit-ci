# Gerrit CI
A CI solution for Gerrit projects.

Runs a list of commands against Gerrit reviews and it sends back the response as comment and vote (+1/-1). It authenticates as the user running the command.

## Getting Started
You can easily integrate the CI in your **existing project** or setup the CI as a **standalone project**, perhaps handling multiple repositories in one place.

## Installation
```
npm install @phntms/gerrit-ci
```
## Integrate the CI into your project
Create a script that imports the library and runs the CI.
```bash
# Using javascript
node gerrit_ci.js
# Using Typescript
ts-node gerrit_ci.ts
```
```typescript
// gerrit_ci.(js|ts)
import {GerritCI} from '@phntms/gerrit-ci';

const gerritCI = new GerritCI({
  repositoryUrl: 'https://android.googlesource.com/kernel/common/',
  targetBranch: 'master',

  pipeline: ['npm run build', 'npm test'],
});

gerritCI.run();
```

## Working on a project while running the CI
The Gerrit CI checks out the single CRs and runs the commands specified in the pipeline in series. As a result, this can not run while also working on the project.

Because of it, if you happen to also work on that project, you may copy or git clone the project on a separate folder so the CI execution does not interfer with the dev work.

```bash
# Copy your existing project in a separate folder for the CI execution
$ cp -r ~/projects/your-project ~/projects/your-project-ci
```

## Use it as a Standalone Project

### Initial setup
The actual project setup is not handled by the CI which expects the project to already be initialised.
By default, the CI expects the project to be in the `./repo` folder ready to build. The path is configurable (please see the `repositoryPath` option).


This means that initially you will need to `git clone` or copy your project folder into the `./repo` folder and run all the command needed to install its requirements to run (e.g. `npm install`  and co).

<u>Once the project is set, you are ready to go!</u>

#### Example of a CI project structure

```
- project_ci/
    |-- node_modules/
    |-- repo/
    | index.ts
    | package.json
```


### Run on multiple projects
```typescript
// index.ts
import {GerritCI} from '@phntms/gerrit-ci';

const fooGerritCI = new GerritCI({
  repositoryUrl: 'https://android.googlesource.com/kernel/common/',
  repositoryPath: './kernel-common/',
  targetBranch: 'master',

  pipeline: ['npm run build', 'npm test'],
});

const barGerritCI = new GerritCI({
  repositoryUrl: 'https://android.googlesource.com/kernel/bar/',
  repositoryPath: './kernel-bar/',
  targetBranch: 'master',

  pipeline: ['npm run build', 'npm test'],
});

fooGerritCI.run();
barGerritCI.run();
```

### Run a single change
```typescript
// npm start ${GERRIT_ID}
const gerritId = process.argv.slice(2)[0];

if (gerritId) {
  // npm start ${GERRIT_ID} --force
  const isForceFlag = (arg) => ['--force', '-f'].includes(arg);
  const forceExecution = process.argv.slice(2).some(isForceFlag);

  gerritCI.runSingleChange(gerritId, forceExecution);
} else {
  gerritCI.run();
}
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
$ pm2 start
```
```js
// ecosystem.config.js
module.exports = {
  apps: [{
    script: './index.ts',
    name: 'foo-gerrit-ci',
    // @see https://crontab.guru/#*/5_*_*_*_*
    cron_restart: '*/5 * * * *',
    // Add timestamp to logs
    time: true,
    // Do not restart once the execution ends
    autorestart: false
  }]
}
```

### Observe logs
Documentation https://pm2.keymetrics.io/docs/usage/log-management/
```bash
# Display only `foo-gerrit-ci` application logs
pm2 logs foo-gerrit-ci
```

### Integrate PM2 in your project
As a cherry on the cake, you could have PM2 as a project dependency.
```
npm install pm2@latest --save-dev
```

```json
"scripts": {
  // ...
  "ci:start": "pm2 start",
  "ci:stop": "pm2 delete",

  // With some seasoning in your script you could also:
  // Run against a single CR [$ npm run ci:exec -- $GERRIT_ID]
  "ci:exec": "ts-node gerrit_ci.js",
  // Overrides the previous CI result [npm run ci:override -- $GERRIT_ID]
  "ci:override": "ts-node gerrit_ci.js --force"
}
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

