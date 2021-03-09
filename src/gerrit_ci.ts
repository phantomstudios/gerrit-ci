import {execSync} from 'child_process';

import {ConfigurationError, ExtractionError} from './gerri_ci_errors';
import {GerritApiService} from './services/gerrit_api_service';
import * as git from './services/git_service';
import {createTaskObject, TaskObject} from './task_object';

const DEFAULT_REPOSITORY_PATH = './repo';
const DEFAULT_LIST_SIZE = 25;

export interface GerritCIConfiguration {
  dryRun?: boolean;
  /**
   * The CI will execute against all the branches that match this RegExp.
   *
   * Note: If "targetBranch" is set, this rule is ignored.
   */
  filterBranch?: RegExp;
  /**
   * The list of tasks to execute
   * ```typescript
   * e.g. pipeline: ["npm run build", "npm run deploy"]
   * e.g. pipeline: [{command: "npm run build", errorMessage: "Build Error!"}]
   * e.g. pipeline: ['npm run build', {
   *   command: "npm run deploy",
   *   successMessage: (output) => `Preview link deployed. ${getUrl(output)}`
   *  }]
   *```
   */
  pipeline: Array<string|TaskObject>;
  /**
   * The repository URL in the following format:
   * - https://(webmaster|agency-code).googlesource.com/[foo/]project-name/
   */
  repositoryUrl: string;
  /** The path to the repository folder. (Default: ./repo) */
  repositoryPath?: string;
  /** The number of reviews to fetch (default: 25 items) */
  sizeList?: number;
  /** The name of the branch the CI should execute against. e.g. "master" */
  targetBranch?: string;
}

function checkConfigurationObject(gerritConfiguration: GerritCIConfiguration) {
  if (!gerritConfiguration.targetBranch && !gerritConfiguration.filterBranch)
    throw new ConfigurationError(
        'Either "targetBranch" or "filterBranch" must be set');

  if (gerritConfiguration.targetBranch && gerritConfiguration.filterBranch) {
    console.warn(
        'Both "targetBranch" and "filterBranch" are set.' +
        '"filterBranch" will be ignored.');
  }

  if (!gerritConfiguration.repositoryUrl)
    throw new ConfigurationError('"repository" is required');

  if (!gerritConfiguration.pipeline)
    throw new ConfigurationError('"pipeline" is required');
}

const EXTRACTION_ERROR_MSG =
    'Make sure the "repository" field follows this exact format: ' +
    'https://(webmaster|agency-code).googlesource.com/[foo/]project-name/';

export class GerritCI {
  /** The gerrit instance e.g. webmaster|agency-code */
  private readonly gerritInstance: string;
  /** The project name including its namespace e.g. foo/bar-project */
  private readonly projectName: string;

  private readonly gerritApiService: GerritApiService;

  constructor(private readonly gerritConfiguration: GerritCIConfiguration) {
    checkConfigurationObject(this.gerritConfiguration);

    // ensure we run from the repo folder
    process.chdir(
        this.gerritConfiguration.repositoryPath || DEFAULT_REPOSITORY_PATH);

    const [_match, instance, projectName] = this.extractRepositorySegments();

    this.gerritInstance = instance;
    this.projectName = projectName.replace(/\/$/g, '');

    this.gerritApiService = new GerritApiService(instance, this.projectName);
  }

  run() {
    // get review list
    // ensure we run from the repo folder
    // process.chdir(join(
    //     __dirname,
    //     this.gerritConfiguration.repositoryPath || DEFAULT_REPOSITORY_PATH));

    const reviewList = this.gerritApiService.getReviewList(
        this.gerritConfiguration.targetBranch,
        this.gerritConfiguration.filterBranch,
        this.gerritConfiguration.sizeList || DEFAULT_LIST_SIZE);

    for (const review of reviewList) {
      try {
        // run CI
        const result = this.runSingleChange(review.id);
        console.log(result || ' - Nothing to do');
      } catch (error) {
        console.log('error while running', review.id);
        console.error(error);
      }
    }
  }

  /** Remember to call gerritCi.end() to close the process */
  runSingleChange(gerritId: string) {
    console.log('Running pipeline for: ' + gerritId);
    const {ciPatchset, isApproved, patchset} =
        this.gerritApiService.getReviewById(gerritId);

    // check if need review (never run || diff patchset)
    if (!ciPatchset || ciPatchset < patchset) {
      // git checkout gerrit.id
      git.checkout(this.gerritInstance, this.projectName, gerritId, patchset)

      // run CI
      const {message, hasError} = this.executePipeline();

      // is error vote -1, if approved do not vote else +1
      const voteField = hasError ? {vote: -1} : {vote: 1};
      const vote = isApproved ? {} : voteField;

      if (!this.gerritConfiguration.dryRun) {
        this.gerritApiService.postReviewCommentById(
            gerritId, patchset, {message, ...vote});
      }

      return {message, hasError};
    }
  }

  private executePipeline() {
    const gerritReplyMessage = [];
    let hasError = false;
    const taskList = this.gerritConfiguration.pipeline.map(createTaskObject);

    for (const task of taskList) {
      try {
        const output = execSync(task.command);
        gerritReplyMessage.push(task.successMessage(output.toString('utf-8')));
      } catch (error) {
        hasError = true;
        gerritReplyMessage.push(task.errorMessage(error as Error));
        break;
      }
    }

    // join the list of messages with a new line
    const message = gerritReplyMessage.join('\n');

    return {message, hasError};
  }

  private extractRepositorySegments() {
    const match = /https:\/\/(\w+)[\.\w+]+\/(.+)\/{0,1}/g.exec(
        this.gerritConfiguration.repositoryUrl);

    if (!match) throw new ExtractionError(EXTRACTION_ERROR_MSG);

    return match;
  }
}
