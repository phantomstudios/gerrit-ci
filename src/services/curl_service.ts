import {execSync, spawnSync} from 'child_process';

function parseJsonResponse(textResponse: string): unknown {
  const antiHijack = ')]}\'\n';
  // Strip anti-hijacking code
  return JSON.parse(textResponse.replace(antiHijack, ''));
}

const curlCommand = 'curl --silent -b `git config http.cookiefile`';

export function get(url: string) {
  const {stdout} =
      spawnSync(`${curlCommand} "${url}"`, {encoding: 'utf-8', shell: true});

  return parseJsonResponse(stdout);
}

export function post(url: string, serialisedData: string) {
  const options = '-H "Content-Type: application/json"';

  return execSync(
      `${curlCommand} -X POST ${options} -d '${serialisedData}' ${url}`,
      {encoding: 'utf-8'});
}
