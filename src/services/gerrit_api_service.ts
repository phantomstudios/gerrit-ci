import * as curl from './curl_service';

/**
 * The flag used to recognise messages from the CI and capture the patchset
 * where this has last executed.
 */
export const CI_MAGIC_STRING = '[-]';

const GET_CI_ACCOUNT_DETAILS_URL =
    'https://agency-code-review.googlesource.com/accounts/self/detail';

/** Review Overview */
export interface ReviewListItem {
  branch: string;
  id: string;
}

interface UserDetailsPayload {
  email: string;
  name: string;
  registered_on: string;
  secondary_emails: string[];
  _account_id: number;
}

interface ReviewDetailsPayload {
  messages: {_revision_number: number}[];
  labels: {'Code-Review': {approved?: UserDetailsPayload}};
}

/** Review Details */
export interface GerritReview {
  /** The latest patchet the CI has been executed. */
  ciPatchset?: string;
  id: string;
  isApproved: boolean;
  ciApproved: boolean;
  noRunFlag?: boolean;
  patchset: string;
}


export interface GerritComment {
  message: string;
  patch_set: string;
}

function constructReviewCommentBody(message: string, vote?: -1|1): string {
  const ciMessage = `${CI_MAGIC_STRING} ${message}`;
  const voteField = vote ? {'labels': {'Code-Review': vote}} : {};

  return JSON.stringify({
    'drafts': 'PUBLISH_ALL_REVISIONS',
    ...voteField,
    'ignore_automatic_attention_set_rules': true,
    'add_to_attention_set': [],
    'remove_from_attention_set': [],
    'comments': {
      '/PATCHSET_LEVEL': [{'message': ciMessage, 'unresolved': false}],
    },
    'reviewers': []
  });
}

/** The service to communicate with Gerrit */
export class GerritApiService {
  constructor(
      /** The gerrit instance e.g. webmaster|agency-code */
      private readonly gerritInstanceName = '',
      /** The project name including its namespace e.g. foo/bar-project */
      private readonly projectName = '',
  ) {}


  /** Get review details from the gerrit id */
  getReviewById(gerritId: string): GerritReview {
    const commentsUrl = this.getReviewCommentsUrl(gerritId);
    const detailsUrl = this.getReviewDetailsUrl(gerritId);

    // Get CI patchset from the latest comments
    const commentData =
        curl.get(commentsUrl) as {'/PATCHSET_LEVEL': GerritComment[]};
    const commentList = (commentData['/PATCHSET_LEVEL'] || []).reverse();
    const lastCiComment =
        commentList.find(({message}) => message.includes(CI_MAGIC_STRING));

    // Get last patchset from the review details
    const {labels, messages} = curl.get(detailsUrl) as ReviewDetailsPayload;
    const lastRevisionMessage = (messages|| []).reverse()[0];
    const approvedUser = (labels || {})['Code-Review']?.approved;

    // Get CI Account ID
    const {_account_id: ciAccountId} =
        curl.get(GET_CI_ACCOUNT_DETAILS_URL) as UserDetailsPayload || {};

    return {
      isApproved: !!approvedUser,
      ciApproved: !!approvedUser && ciAccountId === approvedUser._account_id,
      ciPatchset: lastCiComment?.patch_set,
      patchset: String(lastRevisionMessage?._revision_number || 1),
      id: gerritId,
    };
  }

  getReviewList(branchName: string, branchFilter?: RegExp, size = 25):
      ReviewListItem[] {
    const url = this.constructReviewListUrl(branchName, size);
    const reviewList = curl.get(url) as {branch: string, _number: number}[];

    return reviewList
        .map(({branch, _number}) => ({branch, id: String(_number)}))
        .filter((review) => {
          return !branchFilter ||
              !branchName && branchFilter.test(review.branch);
        });
  }

  postReviewCommentById(gerritId: string, patchset: string, {message, vote}: {
    message: string,
    vote?: -1|1
  }) {
    const url = this.constructReviewPostRequestUrl(gerritId, patchset);
    // construct the post body based on comment and vote

    const body = constructReviewCommentBody(message, vote);
    // TODO(marucci): if errors, log this in a file
    curl.post(url, body);
  }

  /** The URL for the project list */
  private constructReviewListUrl(branchName: string, listSize = 25) {
    const gerritDomain = `${this.gerritInstanceName}-review.googlesource.com`;
    const encodedProjectName = this.projectName.replace('/', '%2F');
    const filterList = ['project:' + encodedProjectName, 'status:open'];
    if (branchName) filterList.push('branch:' + branchName);

    const encodedFilterList = filterList.join('%20').replace(/:/g, '%3A');

    return `https://${gerritDomain}/changes/?O=81&S=0&n=${listSize}&q=${
        encodedFilterList}`;
  }

  /** The URL for the single project */
  private getReviewCommentsUrl(id: string) {
    const gerritDomain = `${this.gerritInstanceName}-review.googlesource.com`;
    const encodedProjectName = this.projectName.replace('/', '%2F');

    return `https://${gerritDomain}/changes/${encodedProjectName}~${
        id}/comments`;
  }

  private getReviewDetailsUrl(id: string) {
    const gerritDomain = `${this.gerritInstanceName}-review.googlesource.com`;
    const encodedProjectName = this.projectName.replace('/', '%2F');

    return `https://${gerritDomain}/changes/${encodedProjectName}~${
        id}/detail`;
  }

  /** The URL for the message POST request */
  private constructReviewPostRequestUrl(id: string, patchset: string) {
    const gerritDomain = `${this.gerritInstanceName}-review.googlesource.com`;
    const encodedProjectName = this.projectName.replace('/', '%2F');

    return `https://${gerritDomain}/changes/${encodedProjectName}~${
        id}/revisions/${patchset}/review`;
  }
}
