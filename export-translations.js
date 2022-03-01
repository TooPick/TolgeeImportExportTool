const axios = require("axios");
const fs = require("fs");
const path = require("path");
const commander = require("commander");
const packageJson = require("./package.json");
const TolgeeUtils = require("./lib/tolgee-utils.js");
require("./lib/object-extension.js");

var default_input_dir = "translations";
var default_api_url = "https://app.tolgee.io/";
var apiKeys = {};

// Init script arguments
commander
  .version(packageJson.version, "-v, --version")
  .usage("[OPTIONS]...")
  .option("-u, --url <value>", "api url", default_api_url)
  .option("-k, --apiKey <value>", "api key")
  .option("-m, --multiple <value>", "conf file for multiple projects")
  .option("-i, --input <value>", "translations input dir", default_input_dir)
  .parse(process.argv);

const options = commander.opts();

let canStart = true;

// Display active arguments
console.info("-------------------");
console.info("Used parameters :");
console.info("url=" + options.url);
console.info("input=" + options.input);
if (options.apiKey) {
  console.info("apiKey=" + options.apiKey);
}
if (options.multiple) {
  console.info("multiple=" + options.multiple);

  try {
    if (fs.existsSync(options.multiple)) {
      apiKeys = require(options.multiple);
      console.info("keys :");
      console.info(apiKeys);
    } else {
      canStart = false;
      console.error("Error : Error config file for multiple imports not found");
    }
  } catch (err) {
    console.error("Error : Error while checking if conf file exists :");
    console.error(err);
  }
}
console.info("-------------------");

var inputDir = "translations";

if (canStart) {
  // Start import script
  startExport();
}

async function startExport() {
  // Check if translation input directory exists
  if (fs.existsSync(inputDir)) {
    if (options.multiple) {
      var folders;
      try {
        folders = fs.readdirSync(inputDir);
      } catch (error) {
        console.error("Error while reading input directory :");
        console.error(error);
      }

      if (folders) {
        for (const folder of folders) {
          await getTranslationFilesInFolder(apiKeys[folder], inputDir, folder);
        }
      }
    } else {
      await getTranslationFilesInFolder(options.apiKey, inputDir, null);
    }
  } else {
    console.error("Error : Input translations directory don't exists");
  }

  console.info("Export successfully completed !");
}

// Find all translation files (en.json, fr.json, etc...) in a folder
async function getTranslationFilesInFolder(apiKey, inputDir, folder = null) {
  var folderPath = inputDir;
  if (folder !== null) {
    folderPath += path.sep + folder;
  }
  var folderStats = fs.statSync(folderPath);
  if (folderStats.isDirectory()) {
    if (apiKey !== undefined) {
      var datas = [];
      var files;

      try {
        files = fs.readdirSync(folderPath);
      } catch (error) {
        console.error("Error : Error while reading translation files :");
        console.error(error);
      }

      for (const file of files) {
        var filePath = folderPath + path.sep + file;
        var fileStats = fs.statSync(filePath);

        // Get only json files
        if (!fileStats.isDirectory() && path.extname(filePath) === ".json") {
          console.info(folderPrint(folder) + "File found : " + filePath);
          let rawData = fs.readFileSync(filePath);
          // Add "flatten" json data with his lang code
          datas.push({
            lang: path.parse(filePath).name,
            data: Object.flatten(JSON.parse(rawData)),
          });
        }
      }

      // Merge all languages in one single json
      await mergeInTolgee(apiKey, mergeTranslationInOneJson(datas), folder);
    } else {
      console.error("Error : Api key not found for : " + folder);
      console.error(error);
    }
  } else {
    console.error("Error: Folder " + folderPath + " is not a directory");
  }
}

// Merge translation files (en.json, fr.json, ...) in one single json object for update in one request
function mergeTranslationInOneJson(jsonDatas) {
  var resultJson = {};

  jsonDatas.forEach((jsonData) => {
    Object.keys(jsonData.data).forEach((key) => {
      if (resultJson[key] === undefined) {
        resultJson[key] = {};
      }

      resultJson[key][jsonData.lang] = jsonData.data[key];
    });
  });

  return resultJson;
}

// Merge Tolgee with merged JSON object
async function mergeInTolgee(apiKey, jsonData, folder = null) {
  try {
    // TODO find a better way to get all { keyName, keyId }
    const response = await axios.get(
      options.url +
        TolgeeUtils.endpoints.translations +
        TolgeeUtils.apiKeyParam(apiKey) +
        "&size=1000"
    );

    if (response.data) {
      // Loop over tolgee data to find keys that are not used anymore
      var toRemove = [];
      response.data._embedded.keys.forEach((transKey) => {
        if (!Object.keys(jsonData).includes(transKey.keyName)) {
          toRemove.push(transKey.keyId);
        }
      });

      // Delete unused keys
      if (toRemove.length > 0) {
        await deleteTranslationKey(apiKey, toRemove, folder);
      }

      // Update all translations (add missing and update existing keys)
      await updateTranslation(apiKey, jsonData, folder);
    }
  } catch (error) {
    console.error("Error : Error while getting translation keys :");
    console.error(error);
  }
}

// Update tolgee translation with merged JSON object
async function updateTranslation(apiKey, jsonData, folder = null) {
  // Loop over all translation keys
  for (const key of Object.keys(jsonData)) {
    var translations = jsonData[key];
    try {
      // Update translation request
      await axios.post(
        options.url +
          TolgeeUtils.endpoints.translations +
          TolgeeUtils.apiKeyParam(apiKey),
        {
          key: key,
          translations,
        }
      );
    } catch (error) {
      console.error(
        folderPrint(folder) +
          "[" +
          key +
          "] : Error while updating translations"
      );
      console.error(error);
    }
  }

  if (folder) {
    console.info(folderPrint(folder) + ": Updated !");
  } else {
    console.info("Translations Updated !");
  }

  // Add this because to close requests cause errors
  await sleep(1000);
}

// Send a request to tolgee to delete translation keys provided
async function deleteTranslationKey(apiKey, keys, folder = null) {
  var keysString = "";
  for (var i = 0; i < keys.length; i++) {
    keysString += keys[i];

    if (i < keys.length - 1) {
      keysString += ",";
    }
  }
  try {
    await axios.delete(
      options.url +
        TolgeeUtils.endpoints.localizationKeys +
        keysString +
        TolgeeUtils.apiKeyParam(apiKey)
    );
  } catch (error) {
    console.error(folderPrint(folder) + "Error while deleting translation key");
    console.error(error);
  }
}

// Use to display the current folder (if translations are in sub-folder)
function folderPrint(folder) {
  if (folder) {
    return "[" + folder + "] ";
  } else {
    return "";
  }
}

// Simple sleep function (to use with await in async functions)
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
