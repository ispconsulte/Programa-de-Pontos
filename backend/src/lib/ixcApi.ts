import {
  ixcFindOneByField,
  ixcList,
  type ClienteContratoItem,
  type ClienteItem,
  type FnAreceberItem,
  type IxcListResponse,
  type TenantCredentials,
} from './ixc-proxy.js'

export interface IxcPaginationInput {
  page?: number
  limit?: number
  sortname?: string
  sortorder?: 'asc' | 'desc'
}

export interface IxcReceivablesByStatusInput extends IxcPaginationInput {
  status: string
}

function normalizePage(value?: number): string {
  const page = Number.isFinite(value) ? Math.trunc(value as number) : 1
  return String(Math.max(1, page))
}

function normalizeLimit(value?: number): string {
  const limit = Number.isFinite(value) ? Math.trunc(value as number) : 20
  return String(Math.min(50, Math.max(1, limit)))
}

export async function listCustomers(
  creds: TenantCredentials,
  pagination: IxcPaginationInput = {},
  ipAddr?: string,
): Promise<IxcListResponse<ClienteItem>> {
  return ixcList<ClienteItem>(creds, 'cliente', {
    qtype: 'cliente.id',
    query: '0',
    oper: '>',
    page: normalizePage(pagination.page),
    rp: normalizeLimit(pagination.limit),
    sortname: pagination.sortname ?? 'id',
    sortorder: pagination.sortorder ?? 'asc',
  }, ipAddr)
}

export async function findCustomerByDocument(
  creds: TenantCredentials,
  document: string,
  ipAddr?: string,
): Promise<ClienteItem | null> {
  return ixcFindOneByField<ClienteItem>(creds, 'cliente', {
    qtype: 'cliente.cnpj_cpf',
    query: document,
    oper: '=',
    sortname: 'id',
    sortorder: 'asc',
  }, ipAddr)
}

export async function findCustomersByName(
  creds: TenantCredentials,
  name: string,
  pagination: IxcPaginationInput = {},
  ipAddr?: string,
): Promise<IxcListResponse<ClienteItem>> {
  return ixcList<ClienteItem>(creds, 'cliente', {
    qtype: 'cliente.razao',
    query: name,
    oper: 'like',
    page: normalizePage(pagination.page),
    rp: normalizeLimit(pagination.limit),
    sortname: pagination.sortname ?? 'razao',
    sortorder: pagination.sortorder ?? 'asc',
  }, ipAddr)
}

export async function fetchContractsByCustomerId(
  creds: TenantCredentials,
  customerId: string,
  pagination: IxcPaginationInput = {},
  ipAddr?: string,
): Promise<IxcListResponse<ClienteContratoItem>> {
  return ixcList<ClienteContratoItem>(creds, 'cliente_contrato', {
    qtype: 'cliente_contrato.id_cliente',
    query: customerId,
    oper: '=',
    page: normalizePage(pagination.page),
    rp: normalizeLimit(pagination.limit ?? 50),
    sortname: pagination.sortname ?? 'id',
    sortorder: pagination.sortorder ?? 'asc',
  }, ipAddr)
}

export async function fetchReceivablesByStatus(
  creds: TenantCredentials,
  input: IxcReceivablesByStatusInput,
  ipAddr?: string,
): Promise<IxcListResponse<FnAreceberItem>> {
  return ixcList<FnAreceberItem>(creds, 'fn_areceber', {
    qtype: 'fn_areceber.status',
    query: input.status,
    oper: '=',
    page: normalizePage(input.page),
    rp: normalizeLimit(input.limit),
    sortname: input.sortname ?? 'data_vencimento',
    sortorder: input.sortorder ?? 'desc',
  }, ipAddr)
}

export type {
  ClienteContratoItem,
  ClienteItem,
  FnAreceberItem,
  IxcListResponse,
  TenantCredentials,
} from './ixc-proxy.js'
