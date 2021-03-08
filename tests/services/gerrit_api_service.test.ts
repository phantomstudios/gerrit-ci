import test from 'ava';
import rewiremock from 'rewiremock';
import * as sinon from 'sinon';

const curlGetStub = sinon.stub();
const curlPostStub = sinon.stub();

rewiremock('./curl_service').with({get: curlGetStub, post: curlPostStub});

rewiremock.enable();
import {CI_MAGIC_STRING, GerritApiService, GerritComment} from '../../src/services/gerrit_api_service';
rewiremock.disable();

const MOCK_REVIEW_PAYLOAD = {
  '/PATCHSET_LEVEL': [
    {message: CI_MAGIC_STRING + 'Test', patch_set: '1'},
    {message: 'Test', patch_set: '2'},
    {message: CI_MAGIC_STRING + 'Test', patch_set: '2'},
    {message: 'Test', patch_set: '3'},
  ] as GerritComment[]
};

const MOCK_REVIEW_LIST_PAYLOAD = [
  {branch: 'master', _number: 123401},
  {branch: 'pham-foo', _number: 123402},
  {branch: 'pham-bar', _number: 123403},
];

function getReviewByIdCurlGetMocks(commentPayload?: unknown, patchset = 1) {
  curlGetStub.resetHistory();
  // Avoid making assumptions about which arguments have been called with
  // This instead ensures that the calls are made in the right sequence
  curlGetStub.onCall(0).returns(commentPayload || {});
  curlGetStub.onCall(1).returns({
    messages: [{_revision_number: patchset}],
  });
}

const gerritApi = new GerritApiService('gerrit', 'namespace/project');

test('initialises with default empty values', ({notThrows}) => {
  notThrows(() => new GerritApiService());
});

test('constructs the request review comment list URL', () => {
  getReviewByIdCurlGetMocks();
  gerritApi.getReviewById('12345');

  sinon.assert.calledWith(
      curlGetStub,
      'https://gerrit-review.googlesource.com/changes/' +
          'namespace%2Fproject~12345/comments');
});

test('constructs the review details URL', () => {
  getReviewByIdCurlGetMocks();
  gerritApi.getReviewById('12345');


  sinon.assert.calledWith(
      curlGetStub,
      'https://gerrit-review.googlesource.com/changes/' +
          'namespace%2Fproject~12345/detail');
});

test('constructs the request review list items URL', () => {
  curlGetStub.returns([]);
  gerritApi.getReviewList('master', undefined, 8);

  sinon.assert.calledWith(
      curlGetStub,
      'https://gerrit-review.googlesource.com/changes/?O=81&S=0&n=8' +
          '&q=project%3Anamespace%2Fproject%20status%3Aopen%20branch%3Amaster');
});

test('constructs the comment POST request URL', () => {
  gerritApi.postReviewCommentById('12345', '1', {message: 'test', vote: 1});

  sinon.assert.calledWith(
      curlPostStub,
      'https://gerrit-review.googlesource.com/changes/' +
          'namespace%2Fproject~12345/revisions/1/review');
});

test('returns the latest CI comment and review patchset', ({is}) => {
  getReviewByIdCurlGetMocks(MOCK_REVIEW_PAYLOAD, 3);
  const {patchset, ciPatchset} = gerritApi.getReviewById('12345');

  is(patchset, '3');
  is(ciPatchset, '2');
});

test('returns the list of reviews with the specified branch filter', (t) => {
  curlGetStub.returns(MOCK_REVIEW_LIST_PAYLOAD);
  const branchFilter = /^pham/g;
  const reviewList = gerritApi.getReviewList('', branchFilter);

  t.true(reviewList.every(({branch}) => branchFilter.test(branch)));
});

test('returns the list of reviews as a list of ReviewListItem', (t) => {
  curlGetStub.returns(MOCK_REVIEW_LIST_PAYLOAD);
  const expectedReview = MOCK_REVIEW_LIST_PAYLOAD[0];
  const [review] = gerritApi.getReviewList('master');

  t.is(review.branch, expectedReview.branch);
  t.is(review.id, String(expectedReview._number));
});

test('sends a POST request with encoded comment body', () => {
  gerritApi.postReviewCommentById('12345', '1', {message: 'test', vote: 1});
  const expectedBody =
      '{"drafts":"PUBLISH_ALL_REVISIONS","labels":{"Code-Review":1},' +
      '"ignore_automatic_attention_set_rules":true,"add_to_attention_set":[],' +
      '"remove_from_attention_set":[],"comments":{"/PATCHSET_LEVEL":' +
      '[{"message":"[-] test","unresolved":false}]},"reviewers":[]}';

  sinon.assert.calledWith(curlPostStub, sinon.match.any, expectedBody);
});
