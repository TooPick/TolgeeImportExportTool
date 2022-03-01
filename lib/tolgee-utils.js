// Create the apiKey parameter string used in the Tolgee API
var apiKeyParam = function (apiKey) {
  return "?ak=" + apiKey;
};

// List of endpoints
var endpoints = {
  exportZip: "api/project/export/jsonZip",
  translations: "v2/projects/translations",
  localizationKeys: "v2/projects/keys/",
};

module.exports = { apiKeyParam, endpoints };
