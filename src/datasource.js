import _ from "lodash";

export class GenericDatasource {

  constructor(instanceSettings, $q, backendSrv) {
    this.type = instanceSettings.type;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.tenant = instanceSettings.jsonData.tenant;
    this.token = instanceSettings.jsonData.token;
    this.q = $q;
    this.backendSrv = backendSrv;
  }

  query(options) {
    var promises = _.chain(options.targets)
      .filter(target => !target.hide)
      .filter(target => target.target !== 'select metric')
      .map(target => {

        var uri = [];
        uri.push(target.type + 's'); // gauges or counters
        uri.push(target.rate ? 'rate' : 'raw'); // raw or rate
        uri.push('query');

        var url = this.url + '/' + uri.join('/');

        return this.backendSrv.datasourceRequest({
          url: url,
          data: {
            ids: [target.target],
            start: options.range.from.valueOf(),
            end: options.range.to.valueOf()
          },
          method: 'POST',
          headers: this.createHeaders()
        }).then(response => {
          return {
            refId: target.refId,
            target: target.target,
            response: response
          };
        });
      })
      .value();

    if (promises.length <= 0) {
      return this.q.when({data: []});
    }

    return this.q.all(promises).then(richResponses => {
      var result = _.map(richResponses, (richResponse) => {
        var response = richResponse.response;
        var datapoints;
        if (response.data.length != 0) {
          datapoints = _.map(response.data[0].data, point => [point.value, point.timestamp]);
        } else {
          datapoints = [];
        }
        return {
          refId: richResponse.refId,
          target: richResponse.target,
          datapoints: datapoints
        };
      });
      return {data: result};
    });
  }

  createHeaders() {
    var headers = {
      'Content-Type': 'application/json',
      'Hawkular-Tenant': this.tenant
    };
    if (typeof this.token === 'string' && this.token.length > 0) {
      headers.Authorization = 'Bearer ' + this.token;
    }
    return headers;
  }

  testDatasource() {
    return this.backendSrv.datasourceRequest({
      url: this.url + '/status',
      method: 'GET'
    }).then(response => {
      if (response.status === 200) {
        return { status: "success", message: "Data source is working", title: "Success" };
      }
    });
  }

  annotationQuery(options) {
    return this.backendSrv.datasourceRequest({
      url: this.url + '/annotations',
      method: 'POST',
      data: options
    }).then(result => {
      return result.data;
    });
  }

  metricFindQuery(options) {
    return this.backendSrv.datasourceRequest({
      url: this.url + '/metrics',
      params: {type: options.type},
      method: 'GET',
      headers: this.createHeaders()
    }).then(result => {
      return _.map(result.data, metric => {
        return {text: metric.id, value: metric.id};
      });
    });
  }
}
