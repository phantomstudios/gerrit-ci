import test from 'ava';
import rewiremock from 'rewiremock';
import * as sinon from 'sinon';

const execSyncSpy = sinon.spy();

rewiremock('child_process').with({execSync: execSyncSpy});

rewiremock.enable();
import {checkout} from '../../src/services/git_service';
rewiremock.disable();

test('constructs the git checkout command', () => {
  checkout('gerrit', 'project', '12345', '2')

  const gerritUrl = 'https://gerrit.googlesource.com/project';
  const reviewRefs = 'refs/changes/45/12345/2';

  sinon.assert.calledOnceWithExactly(
      execSyncSpy,
      `git fetch ${gerritUrl} ${reviewRefs} && git checkout FETCH_HEAD`);
})
