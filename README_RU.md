Эта страница на [English](/README.md)

# IONDV. SOAP

SOAP - модуль IONDV. Framework. Применяется для быстрого создания веб-сервисов на
основе метаданных для реализации микросервисной архитектуры. Модуль позволяет также
интегрировать приложения созданные на фреймворке с другими системами и
обеспечивает обмен данными в формате XML для реализации произвольных пользовательских интерфейсов
(в том числе SPA созданные на фреймворках Angular, Redux, Vue и т.д.).

### Кратко об IONDV. Framework

IONDV. Framework - это опенсорный фреймворк на node.js для разработки учетных приложений 
или микросервисов на основе метаданных и отдельных модулей. Он является частью 
инструментальной цифровой платформы для создания enterprise 
(ERP) приложений состоящей из опенсорсных компонентов: самого [фреймворка](https://github.com/iondv/framework), 
[модулей](https://github.com/topics/iondv-module) и готовых приложений расширяющих его 
функциональность, визуальной среды [Studio](https://github.com/iondv/studio) для 
разработки метаданных приложений.

Подробнее об [IONDV. Framework на сайте](https://iondv.com), документация доступна в [репозитории на github](https://github.com/iondv/framework/blob/master/docs/en/index.md)

### Регистрация сервиса в конфигурации приложения 
Для подключения сервисов в приложении их необходимо сконфигурировать в глобальных настройках модуля soap в файле 
deploy.json приложения. Пример приведен ниже.

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

Путь к регистрациям сервиса в файле `deploy.json` - `modules.soap.globals.di`, далее указывается название сервиса, которое
будет доступно по адресу `https://domain.com/soap/serviceName`, где serviceName - имя сервиса, указываемого в di, например
в примере выше `simle` или `string-list`. В атрибуте `module` указывается путь к js-файлу с обработчиком сервиса с путем относительно
корня фреймворка. Обработчик может быть как в приложении, так и в любом модуле или фреймворке, в т.ч. типовые обработчики модуля rest.

В параметре `options` указываются параметры сервиса:
* в поле `dataRepo` - репозиторий данных, может быть пропущено
* в поле `auth`- ресурс авторизации, может быть пропущено
* поле `stringClassName` является примером произвольного названия ресурса в значении которого указан код класса метаданных в примере
класс `class_string@develop-and-test` - передается как параметр в options сервиса (например `options.stringClassName` и 
используется для получения объектов в репозитории данных, 
пример запроса `options.dataRepo.getList(options.stringClassName, {filter: filter}).then(function (results) {`)

## Описание и назначение модуля

Применяется для обмена произвольными сообщениями в формате  XML. Позволяет вести обмен данными между системой и стороним сервисом, обмениваясь структурированными сообщениями.

## Возможности модуля

* Возможность работы сервисов с любым протоколом транспортного уровня, вместо HTTP.
* Стандартизация обработки ошибок.
* Работает с операциями, такими как транзакции или другие объекты, имеющие сложную логику.
* Обеспечивает безопасность и устойчивость приложения при взаимодействии.
* Удобный синтаксис для описания иерархии данных за счет формата XML.

_Пример:_
Передать имена и значения атрибутов - такое происходит практически при каждом переходе по ссылке или после нажатию на кнопке формы.
```
http://www.server.ru/page.php?name=Vasya&age=20&sex=male&street=Titova%2013&city=Moscow&country=Russia
```

Ответ:
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
Передавая в SOAP именно такую структуру, мы можем сообщить не только атрибуты и их значения, но и их зависимость и иерархию. 

## Применение модуля на примере демо-версий проектов

Модуль _SOAP_ используется для демо-версии проекта [dnt.iondv.com](https://dnt.iondv.com/geomap). Приложение отображает основные возможности и функциональность систем, реализованных на IONDV.Framework. 


--------------------------------------------------------------------------  


 #### [Licence](/LICENSE) &ensp;  [Contact us](https://iondv.com) &ensp;   [English](/README.md)   &ensp; [FAQs](/faqs.md)          

<div><img src="https://mc.iondv.com/watch/local/docs/soap" style="position:absolute; left:-9999px;" height=1 width=1 alt="iondv metrics"></div>

--------------------------------------------------------------------------  

Copyright (c) 2018 **LLC "ION DV"**.  
All rights reserved. 