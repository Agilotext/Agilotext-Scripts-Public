/**
 * Pastilles Mes fichiers / Non classé.
 * Une seule lecture de getTranscriptFolders, sans filtre de statut.
 */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.AgiloFolderCounts = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function folderJobsCount(folder) {
    var raw =
      folder.jobsCount != null ? folder.jobsCount :
      folder.count != null ? folder.count :
      folder.jobCount != null ? folder.jobCount :
      folder.nbJobs != null ? folder.nbJobs :
      folder.totalJobs != null ? folder.totalJobs :
      folder.jobs_count != null ? folder.jobs_count :
      folder.numJobs != null ? folder.numJobs :
      folder.numberOfJobs;
    var n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function countsFromFolderApi(payload) {
    var body = payload || {};
    var rootRaw = body.rootJobsCount != null ? body.rootJobsCount : body.rootCount;
    var rootJobsCount = Number(rootRaw);
    if (!Number.isFinite(rootJobsCount) || rootJobsCount < 0) rootJobsCount = 0;
    var rawList = body.folders || body.transcriptFolderDtos || body.transcriptFolders || body.folderDtos || [];
    var folders = [];
    var folderSum = 0;
    (Array.isArray(rawList) ? rawList : []).forEach(function (folder) {
      var folderId = Number(folder.folderId != null ? folder.folderId : folder.id) || 0;
      var folderName = String(folder.folderName != null ? folder.folderName : folder.name || "").trim();
      if (folderId <= 0 || !folderName) return;
      var jobsCount = folderJobsCount(folder);
      folders.push({ folderId: folderId, folderName: folderName, jobsCount: jobsCount });
      folderSum += jobsCount;
    });
    return {
      rootJobsCount: rootJobsCount,
      total: rootJobsCount + folderSum,
      folders: folders
    };
  }

  function editionFromPath(pathname) {
    var path = String(pathname || "");
    if (path.indexOf("/app/free/") !== -1) return "free";
    if (path.indexOf("/app/pro/") !== -1 || path.indexOf("/app/premium/") !== -1) return "pro";
    if (path.indexOf("/app/ent/") !== -1 || path.indexOf("/app/business/") !== -1) return "ent";
    return "";
  }

  return {
    countsFromFolderApi: countsFromFolderApi,
    editionFromPath: editionFromPath
  };
});
