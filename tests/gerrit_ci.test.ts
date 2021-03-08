import test from 'ava';
import rewiremock from 'rewiremock';
import * as sinon from 'sinon';
import {TEST_ONLY} from '../src/task_object';

const {DEFAULT_ERROR_MESSAGE, DEFAULT_SUCCESS_MESSAGE} = TEST_ONLY;

const execSyncStub = sinon.stub();
const gerritApiStub = {
  getReviewById: sinon.stub(),
  postReviewCommentById: sinon.stub(),
};
const gitCheckoutSpy = sinon.spy();
sinon.stub(process, 'chdir');

rewiremock('child_process').with({execSync: execSyncStub});
rewiremock('./services/gerrit_api_service').with({
  GerritApiService: sinon.stub().returns(gerritApiStub),
});
rewiremock('./services/git_service').with({checkout: gitCheckoutSpy});

rewiremock.enable();
import {GerritCI} from '../src/gerrit_ci';
rewiremock.disable();

test('errors when a required config is missing', ({is, throws}) => {
  const error =
      throws(() => new GerritCI({repositoryUrl: 'url', pipeline: []}));
  is(error.message,
     '[Configuration Error] ' +
         'Either "targetBranch" or "filterBranch" must be set');
});

test('errors when the "repositoryUrl" is in a wrong format', (t) => {
  const error = t.throws(
      () => new GerritCI(
          {repositoryUrl: 'url', targetBranch: 'master', pipeline: []}));

  const expectedError = '[Extraction Error] ' +
      'Make sure the "repository" field follows this exact format: ' +
      'https://(webmaster|agency-code).googlesource.com/[foo/]project-name/';

  t.is(error.message, expectedError);
});

test('runs a single review when no ciPatchset is set', () => {
  const gerritCI = new GerritCI({
    repositoryUrl: 'https://gerrit.googlesource.com/project',
    targetBranch: 'master',
    pipeline: [],
  });

  gerritApiStub.getReviewById.returns({patchset: '1'});
  gerritCI.runSingleChange('12345');

  sinon.assert.calledWith(gerritApiStub.getReviewById, '12345');
  sinon.assert.calledWith(gitCheckoutSpy, 'gerrit', 'project', '12345', '1');
  sinon.assert.calledWith(gerritApiStub.postReviewCommentById, '12345', '1');
});


test('runs a single review when a new patchset is uploaded', () => {
  const gerritCI = new GerritCI({
    repositoryUrl: 'https://gerrit.googlesource.com/project',
    targetBranch: 'master',
    pipeline: [],
  });

  gerritApiStub.getReviewById.returns({ciPatchset: '1', patchset: '2'});
  gerritCI.runSingleChange('12345');

  sinon.assert.calledWith(gerritApiStub.getReviewById, '12345');
  sinon.assert.calledWith(gitCheckoutSpy, 'gerrit', 'project', '12345', '2');
  sinon.assert.calledWith(gerritApiStub.postReviewCommentById, '12345', '2');
});

test('skips the review if the CI has already run', ({assert}) => {
  gitCheckoutSpy.resetHistory();
  gerritApiStub.postReviewCommentById.resetHistory();

  const gerritCI = new GerritCI({
    repositoryUrl: 'https://gerrit.googlesource.com/project',
    targetBranch: 'master',
    pipeline: [],
  });

  gerritApiStub.getReviewById.returns({ciPatchset: '1', patchset: '1'});
  gerritCI.runSingleChange('12345');

  sinon.assert.calledWith(gerritApiStub.getReviewById, '12345');
  assert(gitCheckoutSpy.notCalled);
  assert(gerritApiStub.postReviewCommentById.notCalled);
});

test('skips the review comments if dryRun is set', ({assert}) => {
  gitCheckoutSpy.resetHistory();
  gerritApiStub.postReviewCommentById.resetHistory();

  const gerritCI = new GerritCI({
    dryRun: true,
    repositoryUrl: 'https://gerrit.googlesource.com/project',
    targetBranch: 'master',
    pipeline: [],
  });

  gerritApiStub.getReviewById.returns({patchset: '1'});
  gerritCI.runSingleChange('12345');

  sinon.assert.calledWith(gerritApiStub.getReviewById, '12345');
  sinon.assert.calledWith(gitCheckoutSpy, 'gerrit', 'project', '12345', '1');
  assert(gerritApiStub.postReviewCommentById.notCalled);
});

test('comments and votes +1 when the pipeline is successful', () => {
  const gerritCI = new GerritCI({
    repositoryUrl: 'https://gerrit.googlesource.com/project',
    targetBranch: 'master',
    pipeline: ['npm run build'],
  });

  execSyncStub.returns({toString: () => 'yay!'});
  gerritApiStub.getReviewById.returns({patchset: '1'});
  gerritCI.runSingleChange('12345');

  const expectedMessage = DEFAULT_SUCCESS_MESSAGE('npm run build');

  sinon.assert.calledWith(execSyncStub, 'npm run build');
  sinon.assert.calledWith(
      gerritApiStub.postReviewCommentById, '12345', '1',
      {message: expectedMessage, vote: 1});
});

test('comments and votes -1 when the pipeline fails', () => {
  const gerritCI = new GerritCI({
    repositoryUrl: 'https://gerrit.googlesource.com/project',
    targetBranch: 'master',
    pipeline: ['npm run build'],
  });

  execSyncStub.throws();
  gerritApiStub.getReviewById.returns({patchset: '1'});
  gerritCI.runSingleChange('12345');

  const expectedMessage = DEFAULT_ERROR_MESSAGE('npm run build');

  sinon.assert.calledWith(execSyncStub, 'npm run build');
  sinon.assert.calledWith(
      gerritApiStub.postReviewCommentById, '12345', '1',
      {message: expectedMessage, vote: -1});
});
