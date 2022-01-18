// @ts-check

/* Infers the rendezvous path for the endo.sock file and apps from the platform
 * and environment.
 */

/**
 * @type {typeof import('./types.js').whereEndo}
 */
export const whereEndo = (platform, env) => {
  if (platform === 'win32') {
    // Favoring local app data over roaming app data since I don't expect to be
    // able to listen on one host and connect on another.
    if (env.LOCALAPPDATA !== undefined) {
      return `${env.LOCALAPPDATA}\\Endo`;
    }
    if (env.APPDATA !== undefined) {
      return `${env.APPDATA}\\Endo`;
    }
    if (env.USERPROFILE !== undefined) {
      return `${env.USERPROFILE}\\AppData\\Endo`;
    }
    if (env.HOMEDRIVE !== undefined && env.HOMEPATH !== undefined) {
      return `${env.HOMEDRIVE}${env.HOMEPATH}\\AppData\\Endo`;
    }
  } else if (platform === 'darwin') {
    if (env.HOME !== undefined) {
      return `${env.HOME}/Library/Application Support/Endo`;
    }
  } else {
    if (env.XDG_RUNTIME_DIR !== undefined) {
      return `${env.XDG_RUNTIME_DIR}/endo`;
    }
    if (env.HOME !== undefined) {
      return `${env.HOME}/.run/endo`;
    }
  }
  return '';
};
