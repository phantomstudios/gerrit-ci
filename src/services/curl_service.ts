import {execSync} from 'child_process';

function parseJsonResponse(textResponse: string): unknown {
  const antiHijack = ')]}\'\n';
  // Strip anti-hijacking code
  return JSON.parse(textResponse.replace(antiHijack, ''));
}

const curlCommand = 'curl --silent -b ~/.gitcookies';

export function get(url: string) {
  const output = execSync(`${curlCommand} ${url}`);

  return parseJsonResponse(output.toString('utf-8'));
}

export function post(url: string, serialisedData: string) {
  const options = '-H "Content-Type: application/json"';

  return execSync(
             `${curlCommand} -X POST ${options} -d '${serialisedData}' ${url}`)
      .toString('utf-8');
}
