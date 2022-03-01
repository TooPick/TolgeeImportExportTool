var apiKeyParam = function (apiKey) {
  return "?ak=" + apiKey;
};

var endpoints = {
  exportZip: "api/project/export/jsonZip",
  translations: "v2/projects/translations",
  localizationKeys: "v2/projects/keys/",
};

module.exports = { apiKeyParam, endpoints };
