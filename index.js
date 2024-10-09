const ApiIntercept = {
  xhr: {},
  fetch: {},
};

// details is an object
details = {
  method: "GET",
  url: "https://api.sandbox.paypal.com/v1/billing/plans",
  headers: {
    "Content-Type": "application/json",
    "Accept-Type": "application/json",
  },
  body: null,
  responseType: "json",
};

ApiIntercept.xhr.read = (details, callback) => {
  (function (xhr) {
    var XHR = XMLHttpRequest.prototype;

    var open = XHR.open;
    var send = XHR.send;
    var setRequestHeader = XHR.setRequestHeader;

    XHR.open = function (method, url) {
      this._method = method;
      this._url = url;
      this._requestHeaders = {};
      this._startTime = new Date().toISOString();

      return open.apply(this, arguments);
    };

    XHR.setRequestHeader = function (header, value) {
      this._requestHeaders[header] = value;
      return setRequestHeader.apply(this, arguments);
    };

    XHR.send = function (postData) {
      this.addEventListener("load", function () {
        var myUrl = this._url ? this._url.toLowerCase() : this._url;

        // Function to check if the required headers match
        function headersMatch(requiredHeaders, requestHeaders) {
          for (let key in requiredHeaders) {
            if (
              !requestHeaders.hasOwnProperty(key) ||
              requestHeaders[key] !== requiredHeaders[key]
            ) {
              return false;
            }
          }
          return true;
        }

        // Check if headers match (if headers are defined in details)
        let headersMatchCondition = details.headers
          ? headersMatch(details.headers, this._requestHeaders)
          : true;
        // Check if method and url exist in details object and match, otherwise allow
        let methodMatches = details.method
          ? this._method === details.method
          : true;
        let urlMatches = details.url
          ? myUrl === details.url.toLowerCase()
          : true;

        // Filter requests based on available details (method and/or url)
        if (methodMatches && urlMatches && headersMatchCondition) {
          // Get the response headers
          var responseHeaders = this.getAllResponseHeaders();

          // Prepare the callback data object
          let callbackData = {
            url: this._url, // URL of the request
            requestHeaders: this._requestHeaders, // Request headers
            requestBody: this._requestBody, // Request body (if any)
            responseHeaders: responseHeaders, // Response headers
            responseBody: null, // Will contain parsed response
          };

          // If the responseType is not 'blob' and responseText exists
          if (this.responseType !== "blob" && this.responseText) {
            try {
              // Try to parse the responseText (assuming it's JSON)
              callbackData.responseBody = JSON.parse(this.responseText);
            } catch (err) {
              // If JSON parsing fails, store the raw responseText
              callbackData.responseBody = this.responseText;
            }
          }

          // Call the provided callback function with the data object
          callback(callbackData);
        }
      });

      return send.apply(this, arguments);
    };
  })(XMLHttpRequest);
};

ApiIntercept.xhr.modify = (details, callback) => {
  (function (xhr) {
    var XHR = XMLHttpRequest.prototype;

    var open = XHR.open;
    var send = XHR.send;
    var setRequestHeader = XHR.setRequestHeader;

    // Intercept the open method
    XHR.open = function (method, url) {
      this._method = method;
      this._url = url;
      this._requestHeaders = {};
      this._startTime = new Date().toISOString();

      return open.apply(this, arguments);
    };

    // Intercept the setRequestHeader method
    XHR.setRequestHeader = function (header, value) {
      this._requestHeaders[header] = value;
      return setRequestHeader.apply(this, arguments);
    };

    // Intercept the send method
    XHR.send = function (postData) {
      // Modify request based on the details object before sending
      if (details.headers) {
        for (let key in details.headers) {
          this.setRequestHeader(key, details.headers[key]);
        }
      }

      // Optionally modify the request body if needed
      if (details.body) {
        postData = details.body; // Replace with new body if specified in details
      }

      // Optional: Modify the URL if necessary
      if (details.url) {
        this._url = details.url; // Change the URL if specified in details
      }

      this.addEventListener("load", function () {
        // Get the response headers
        var responseHeaders = this.getAllResponseHeaders();

        // Prepare the callback data object
        let callbackData = {
          url: this._url, // URL of the request
          requestHeaders: this._requestHeaders, // Request headers
          requestBody: postData, // Modified request body
          responseHeaders: responseHeaders, // Response headers
          responseBody: null, // Will contain parsed response
        };

        // If the responseType is not 'blob' and responseText exists
        if (this.responseType !== "blob" && this.responseText) {
          try {
            // Try to parse the responseText (assuming it's JSON)
            callbackData.responseBody = JSON.parse(this.responseText);
          } catch (err) {
            // If JSON parsing fails, store the raw responseText
            callbackData.responseBody = this.responseText;
          }
        }

        // Call the provided callback function with the data object
        callback(callbackData);
      });

      return send.apply(this, [postData]);
    };
  })(XMLHttpRequest);
};

ApiIntercept.fetch.read = (details, callback) => {
  // Save the original fetch function
  const originalFetch = window.fetch;

  // Override the fetch function
  window.fetch = function (...args) {
    const requestDetails = {
      method: args[0].method || "GET",
      url: args[0].url || args[0],
      headers: args[0].headers || {},
      body: args[0].body || null,
    };

    return originalFetch
      .apply(this, args)
      .then((response) => {
        const clonedResponse = response.clone();

        // Get the response body
        clonedResponse.json().then((responseBody) => {
          const responseHeaders = {};
          response.headers.forEach((value, name) => {
            responseHeaders[name] = value;
          });

          // Check if the request matches the details filter
          const isMethodMatch = details.method
            ? requestDetails.method === details.method
            : true;
          const isUrlMatch = details.url
            ? requestDetails.url === details.url
            : true;
          const isHeadersMatch = details.headers
            ? Object.entries(details.headers).every(
                ([key, value]) => requestDetails.headers[key] === value
              )
            : true;

          if (isMethodMatch && isUrlMatch && isHeadersMatch) {
            // Call the callback with the desired parameters
            callback({
              url: requestDetails.url,
              requestHeaders: requestDetails.headers,
              requestBody: requestDetails.body,
              responseHeaders: responseHeaders,
              responseBody: responseBody,
            });
          }
        });

        return response; // Return the original response
      })
      .catch((error) => {
        throw error; // Propagate the error
      });
  };
};

// Function to modify the fetch request
ApiIntercept.fetch.modify = (details, callback) => {
  // Store the original fetch function
  const originalFetch = window.fetch;

  // Override the fetch function
  window.fetch = function (...args) {
    // Check if details contain the properties to modify
    const requestDetails = {
      method: details.method || args[1]?.method || "GET",
      url: details.url || args[0],
      headers: { ...args[1]?.headers, ...details.headers }, // Merge headers
      body: details.body || args[1]?.body || null,
    };

    // Create a new request using the modified details
    const modifiedRequest = new Request(requestDetails.url, {
      method: requestDetails.method,
      headers: requestDetails.headers,
      body: requestDetails.body,
    });

    return originalFetch(modifiedRequest)
      .then((response) => {
        const clonedResponse = response.clone();

        // Get the response body
        clonedResponse.json().then((responseBody) => {
          const responseHeaders = {};
          response.headers.forEach((value, name) => {
            responseHeaders[name] = value;
          });
          // Call the callback with the desired parameters
          callback({
            url: requestDetails.url,
            requestHeaders: requestDetails.headers,
            requestBody: requestDetails.body,
            responseHeaders: responseHeaders,
            responseBody: responseBody,
          });
        });

        return response; // Return the original response
      })
      .catch((error) => {
        throw error; // Propagate the error
      });
  };
};

// ApiIntercept.xhr.read()
// ApiIntercept.xhr.modify()
// ApiIntercept.fetch.read()
// ApiIntercept.fetch.modify()
