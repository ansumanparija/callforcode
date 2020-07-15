const Cloudant = require("@cloudant/cloudant");

const cloudant_id = process.env.CLOUDANT_ID || "<cloudant_id>";
const cloudant_apikey = process.env.CLOUDANT_IAM_APIKEY || "<cloudant_apikey>";

// UUID creation
const uuidv4 = require("uuid/v4");

var cloudant = new Cloudant({
  account: cloudant_id,

  plugins: {
    iamauth: {
      iamApiKey: cloudant_apikey,
    },
  },
});

// Cloudant DB reference
let db;
let db_name = "blaster_db";

/**
 * Connects to the Cloudant DB, creating it if does not already exist
 * @return {Promise} - when resolved, contains the db, ready to go
 */
const dbCloudantConnect = () => {
  return new Promise((resolve, reject) => {
    Cloudant(
      {
        // eslint-disable-line
        account: cloudant_id,
        plugins: {
          iamauth: {
            iamApiKey: cloudant_apikey,
          },
        },
      },
      (err, cloudant) => {
        if (err) {
          console.log(
            "Connect failure: " +
              err.message +
              " for Cloudant ID: " +
              cloudant_id
          );
          reject(err);
        } else {
          cloudant.db
            .list()
            .then((body) => {
              if (!body.includes(db_name)) {
                console.log("DB Does not exist..creating: " + db_name);
                cloudant.db.create(db_name).then(() => {
                  if (err) {
                    console.log(
                      "DB Create failure: " +
                        err.message +
                        " for Cloudant ID: " +
                        cloudant_id
                    );
                    reject(err);
                  }
                });
              }
              let db = cloudant.use(db_name);
              console.log("Connect success! Connected to DB: " + db_name);
              resolve(db);
            })
            .catch((err) => {
              console.log(err);
              reject(err);
            });
        }
      }
    );
  });
};

// Initialize the DB when this module is loaded
(function getDbConnection() {
  console.log("Initializing Cloudant connection...", "getDbConnection()");
  dbCloudantConnect()
    .then((database) => {
      console.log("Cloudant connection initialized.", "getDbConnection()");
      db = database;
    })
    .catch((err) => {
      console.log(
        "Error while initializing DB: " + err.message,
        "getDbConnection()"
      );
      throw err;
    });
})();

/**
 * Find all resources that match the specified partial name.
 *
 * @param {String} type
 * @param {String} partialName
 * @param {String} userID
 *
 * @return {Promise} Promise -
 *  resolve(): all resource objects that contain the partial
 *          name, type or userID provided, or an empty array if nothing
 *          could be located that matches.
 *  reject(): the err object from the underlying data store
 */
function find(donorId) {
  return new Promise((resolve, reject) => {
    let selector = {};
    if (donorId) {
      selector["donorId"] = donorId;
    }

    db.find(
      {
        selector: selector,
      },
      (err, documents) => {
        if (err) {
          reject(err);
        } else {
          resolve({ data: JSON.stringify(documents.docs), statusCode: 200 });
        }
      }
    );
  });
}

/**
 * Delete a resource that matches a ID.
 *
 * @param {String} id
 *
 * @return {Promise} Promise -
 *  resolve(): Status code as to whether to the object was deleted
 *  reject(): the err object from the underlying data store
 */
function deleteById(id, rev) {
  return new Promise((resolve, reject) => {
    db.get(id, (err, document) => {
      if (err) {
        resolve(err.statusCode);
      } else {
        db.destroy(id, document._rev, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(200);
          }
        });
      }
    });
  });
}

/**
 * Create a resource with the specified attributes
 *
 * @param {String} type - the type of the item
 * @param {String} name - the name of the item
 * @param {String} description - the description of the item
 * @param {String} quantity - the quantity available
 * @param {String} location - the GPS location of the item
 * @param {String} contact - the contact info
 * @param {String} userID - the ID of the user
 *
 * @return {Promise} - promise that will be resolved (or rejected)
 * when the call to the DB completes
 */
function create(donor) {
  return new Promise((resolve, reject) => {
    let itemId = uuidv4();
    if (donor._id === undefined || donor._id == null) {
      donor._id = itemId;
    }
    db.insert(donor, (err, result) => {
      if (err) {
        console.log("Error occurred: " + err.message, "create()");
        reject(err);
      } else {
        resolve({
          data: { id: result.id, rev: result.rev },
          statusCode: 201,
        });
      }
    });
  });
}

function update(donor) {
  return new Promise((resolve, reject) => {
    find(donor.donorId)
      .then(
        (data) => {
          console.log("donor details: " + JSON.stringify(data));
          donor._rev = data._rev;
          db.insert(donor, (err, result) => {
            if (err) {
              console.log("Error occurred: " + err.message, "create()");
              reject(err);
            } else {
              resolve({ data: { rev: result.rev }, statusCode: 200 });
            }
          });
        },
        (err) => {
          reject(err);
        }
      )
      .catch((err) => {
        reject(err);
      });
  });
}

/**
 * Update a resource with the requested new attribute values
 *
 * @param {String} id - the ID of the item (required)
 *
 * The following parameters can be null
 *
 * @param {String} type - the type of the item
 * @param {String} name - the name of the item
 * @param {String} description - the description of the item
 * @param {String} quantity - the quantity available
 * @param {String} location - the GPS location of the item
 * @param {String} contact - the contact info
 * @param {String} userID - the ID of the user
 *
 * @return {Promise} - promise that will be resolved (or rejected)
 * when the call to the DB completes
 */
function update(
  id,
  type,
  name,
  description,
  quantity,
  location,
  contact,
  userID
) {
  return new Promise((resolve, reject) => {
    db.get(id, (err, document) => {
      if (err) {
        resolve({ statusCode: err.statusCode });
      } else {
        let item = {
          _id: document._id,
          _rev: document._rev, // Specifiying the _rev turns this into an update
        };
        if (type) {
          item["type"] = type;
        } else {
          item["type"] = document.type;
        }
        if (name) {
          item["name"] = name;
        } else {
          item["name"] = document.name;
        }
        if (description) {
          item["description"] = description;
        } else {
          item["description"] = document.description;
        }
        if (quantity) {
          item["quantity"] = quantity;
        } else {
          item["quantity"] = document.quantity;
        }
        if (location) {
          item["location"] = location;
        } else {
          item["location"] = document.location;
        }
        if (contact) {
          item["contact"] = contact;
        } else {
          item["contact"] = document.contact;
        }
        if (userID) {
          item["userID"] = userID;
        } else {
          item["userID"] = document.userID;
        }

        db.insert(item, (err, result) => {
          if (err) {
            console.log("Error occurred: " + err.message, "create()");
            reject(err);
          } else {
            resolve({ data: { updatedRevId: result.rev }, statusCode: 200 });
          }
        });
      }
    });
  });
}

function info() {
  return cloudant.db.get(db_name).then((res) => {
    console.log(res);
    return res;
  });
}

module.exports = {
  create: create,
  update: update,
  find: find,
  info: info,
};