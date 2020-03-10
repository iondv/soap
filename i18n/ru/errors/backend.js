const codes = require('../../../errors/backend-errors');

module.exports = {
  [codes.NO_CONNECTION]: `Клиент не подключен к сервису %service`,
  [codes.NO_METHOD]: `Метод %method не найден в сервисе %service`,
  [codes.NO_WSDL_INTERFACE]: `WSDL не содержит описания интерфейсов.`,
  [codes.NO_ID]: `Не передан идентификатор редактируемого объекта!`,
  [codes.NO_BODY]: `The response message does not contain a body.`,
  [codes.EMPTY_SOAP_MSG]: `Empty SOAP message!`,
  [codes.UNSUPPORTED_TYPE]: `Неподдерживаемый тип %type`,
  [codes.WRONG_NODE]: `Элемент %type.%name противоречит схеме данных.`,
  [codes.WRONG_ARG]: `Передан некорректный аргумент метода: %arg вместо %tag`,
  [codes.LACK_ARGS]: `Переданы не все аргументы метода.`,
  [codes.WASTE_ARGS]: `Метод вызван с лишними аргументами.`,
  [codes.HTTP_500]: `Внутренняя ошибка сервера`,
  [codes.HTTP_404]: `Сервис с указанным именем не найден.`
};
