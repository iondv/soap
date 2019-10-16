This page in [Russian](/README_RU.md)

# IONDV. SOAP

**SOAP** -  is an IONDV. Framework module. It is used to quickly create web services,
based on metadata for implementing microservice architecture. The module also allows you to integrate applications created on the framework with other systems. SOAP provides data exchange in XML format to implement arbitrary user interfaces (including SPA created on the Angular, Redux, Vue frameworks).

### IONDV. Framework in brief

**IONDV. Framework** - is a node.js open source framework for developing accounting applications
or microservices based on metadata and individual modules. Framework is a part of 
instrumental digital platform to create enterprise 
(ERP) apps. This platform consists of the following open-source components: the [IONDV. Framework](https://github.com/iondv/framework), the
[modules](https://github.com/topics/iondv-module) и ready-made applications expanding it
functionality, visual development environment [Studio](https://github.com/iondv/studio) to create metadata for the app.

* For more details, see [IONDV. Framework site](https://iondv.com). 

* Documentation is available in the [Github repository](https://github.com/iondv/framework/blob/master/docs/en/index.md).

### Service registration in application configuration

To connect services in the application, you need to configure them in the global settings of the soap module in the application configuration file - deploy.json. See an example below.

```json
{
  "modules": {
    "soap": {
      "globals": {
        "di": {
          "simple": {
            "module": "applications/develop-and-test/service/SimpleRest"
          },
          "string-list": {
            "module": "applications/develop-and-test/service/String-list",
            "options": {
              "stringClassName": "class_string@develop-and-test",
              "dataRepo": "ion://dataRepo"
            }
          },
          "crud": {
            "module": "modules/rest/lib/impl/crud",
            "options": {
               "auth": "ion://auth",
               "dataRepo": "ion://securedDataRepo"
            }
          }
```

The path to the service registrations in the file `deploy.json` is `modules.soap.globals.di`, next is the name of the service, which
will be available at `https://domain.com/soap/serviceName`, where `serviceName` is the name of the service specified in `di`, in the example above `simle` or `string-list`. In the `module` attribute indicate the path to the js file with the service handler with the path relatively to the root of the framework. The handler can be both in the application and in any module or framework, including sample rest module handlers.

Service parameters are set in the `options`:
* `dataRepo` field - data repository (may be skipped)
* `auth` field - authorization resource (may be skipped)
* `stringClassName` field - is an example of an arbitrary resource name in the value of which the metadata class code is indicated, as an example - the `class_string@develop-and-test` class passed as a parameter to the options service (e.g. `options.stringClassName` used to get objects in the data repository, request example `options.dataRepo.getList(options.stringClassName, {filter: filter}).then(function (results) {`)

## Description

The module is used to exchange arbitrary messages in XML format. It allows you to exchange data between the system and a third-party service, by swaping structured messages.

## Module features

* Work with services with any Transport Protocol, instead of HTTP.
* Standardization of error handling.
* Works with operations, such as transactions or other objects that have complex logic.
* Provides security and stability of the application in the interaction.
* Handy syntax for describing data hierarchy due to XML format.

_Example:_

The goal is to pass the names and values of the attributes. It happens almost every time you click on the link or after clicking on the form button.

```
http://www.server.ru/page.php?name=Vasya&age=20&sex=male&street=Titova%2013&city=Moscow&country=Russia
```

Response:
```
<person>
    <id>1000</id>
    <name>Vasya</name>
    <age>20</age>
    <sex>male</sex>
    <address>
        <street>Titova 13</street>
        <city>Moscow</city>
        <country>Russia</country>
    </address>
</person>
```
If we pass this structure to SOAP, we can report not only attributes and their values, but also their dependency and hierarchy. 

## Intended use of the module using demo projects as an example

_SOAP_ module is used in [dnt.iondv.com](https://dnt.iondv.com/geomap). The application shows the main features and functionality of systems implemented on IONDV. Framework.


--------------------------------------------------------------------------  


 #### [Licence](/LICENSE) &ensp;  [Contact us](https://iondv.com) &ensp;   [Russian](/README_RU.md)   &ensp; [FAQs](/faqs.md)          

<div><img src="https://mc.iondv.com/watch/github/docs/soap" style="position:absolute; left:-9999px;" height=1 width=1 alt="iondv metrics"></div>

--------------------------------------------------------------------------  

Copyright (c) 2018 **LLC "ION DV"**.  
All rights reserved. 