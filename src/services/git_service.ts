import {execSync} from 'child_process';

/** Checkouts a gerrit review */
export function checkout(
    gerritInstance: string, projectName: string, reviewId: string,
    patchset: string) {
  const gerritUrl = `https://${gerritInstance}.googlesource.com/${projectName}`;
  const lastTwoDigits = reviewId.slice(-2);
  const reviewRefs = `refs/changes/${lastTwoDigits}/${reviewId}/${patchset}`;

  const gitFetch = `git fetch ${gerritUrl} ${reviewRefs}`;
  const gitCheckout = 'git checkout FETCH_HEAD';

  execSync(`${gitFetch} && ${gitCheckout}`);
}
