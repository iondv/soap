const { IonError } = require('@iondv/core');
const { w: t } = require('@iondv/i18n');

const prefix = 'soap.backend';

const codes = module.exports = {
  NO_CONNECTION: `${prefix}.noconnection`,
  NO_METHOD: `${prefix}.nomethod`,
  NO_WSDL_INTERFACE: `${prefix}.nowsdlinterf`,
  NO_ID: `${prefix}.noid`,
  NO_BODY: `${prefix}.nobody`,
  EMPTY_SOAP_MSG: `${prefix}.emptysoapmsg`,
  UNSUPPORTED_TYPE: `${prefix}.unsuptype`,
  WRONG_NODE: `${prefix}.wrongnode`,
  WRONG_ARG: `${prefix}.wrongarg`,
  LACK_ARGS: `${prefix}.lackargs`,
  WASTE_ARGS: `${prefix}.wasteargs`
};

IonError.registerMessages({
  [codes.NO_CONNECTION]: t('The client is not connected to service %service'),
  [codes.NO_METHOD]: t('Method %method could not be found in service %service'),
  [codes.NO_WSDL_INTERFACE]: t('WSDL does not contain descriptions of interfaces.'),
  [codes.NO_ID]: t('ID of the edited object was not passed!'),
  [codes.NO_BODY]: t('The response message does not contain a body.'),
  [codes.EMPTY_SOAP_MSG]: t('Empty SOAP message!'),
  [codes.UNSUPPORTED_TYPE]: t('Unsupported type %type'),
  [codes.WRONG_NODE]: t('Element %type.%name is not consistent with the data scheme.'),
  [codes.WRONG_ARG]: t('Incorrect method argument passed: %arg instead of %tag'),
  [codes.LACK_ARGS]: t('The number of method arguments passed is less that expected.'),
  [codes.WASTE_ARGS]: t('The method was called with excessive arguments.'),
  [codes.HTTP_500]: t('Internal server error'),
  [codes.HTTP_404]: t('Service with the specified name could not be found.')
});
