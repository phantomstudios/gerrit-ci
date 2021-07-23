import test from 'ava';
import rewiremock from 'rewiremock';
import * as sinon from 'sinon';

const execSyncStub = sinon.stub().returns('{}');
const spawnSyncStub = sinon.stub().returns({stdout: '{}'});

rewiremock('child_process')
    .with({execSync: execSyncStub, spawnSync: spawnSyncStub});

rewiremock.enable();
import {get, post} from '../../src/services/curl_service';
rewiremock.disable();

test('curl.get is called and parses the anti hiJack', () => {
  get('https://website.com/get/');

  sinon.assert.calledWith(
      spawnSyncStub,
      'curl --silent -b `git config http.cookiefile` "https://website.com/get/"',
      {shell: true, encoding: 'utf-8'});
});

test('curl.get parses a response with the antiHiJack', ({deepEqual}) => {
  const antihijack = ')]}\'\n';
  const expectedOutput = {expected: 'output'};

  spawnSyncStub.returns({stdout: antihijack + JSON.stringify(expectedOutput)});

  deepEqual(get('https://website.com/get/'), expectedOutput);
});

test('curl.post request is contructed correctly', () => {
  post('https://website.com/post/', '{"expected": "data"}');

  sinon.assert.calledWith(
      execSyncStub,
      'curl --silent -b `git config http.cookiefile` -X POST ' +
          `-H "Content-Type: application/json" -d '{"expected": "data"}' ` +
          'https://website.com/post/');
})
