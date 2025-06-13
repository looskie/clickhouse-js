import { toSearchParams } from '@clickhouse/client-common'
import type { URLSearchParams } from 'url'

describe('toSearchParams', () => {
  it('should return only query_id, ignoring the default database', async () => {
    const params = toSearchParams({ database: 'default', query_id: 'foo' })
    expect(toSortedArray(params)).toEqual([['query_id', 'foo']])
  })

  it('should set database', async () => {
    const params = toSearchParams({ database: 'my_db', query_id: 'foo' })!
    expect(toSortedArray(params)).toEqual([
      ['database', 'my_db'],
      ['query_id', 'foo'],
    ])
  })

  it('should set ClickHouse settings', async () => {
    const params = toSearchParams({
      database: 'default',
      query_id: 'foo',
      clickhouse_settings: {
        insert_quorum: '2',
        distributed_product_mode: 'global',
        limit: '42',
        allow_nondeterministic_mutations: undefined, // will be omitted
      },
    })!
    expect(toSortedArray(params)).toEqual([
      ['distributed_product_mode', 'global'],
      ['insert_quorum', '2'],
      ['limit', '42'],
      ['query_id', 'foo'],
    ])
  })

  it('should set query params', async () => {
    const params = toSearchParams({
      database: 'default',
      query_id: 'foo',
      query_params: {
        foo: 42,
        bar: true,
        qaz: 'qux',
      },
    })!
    expect(toSortedArray(params)).toEqual([
      ['param_bar', '1'],
      ['param_foo', '42'],
      ['param_qaz', 'qux'],
      ['query_id', 'foo'],
    ])
  })

  it('should set query', async () => {
    const query = 'SELECT * FROM system.settings'
    const params = toSearchParams({
      database: 'default',
      query_id: 'foo',
      query,
    })!
    expect(toSortedArray(params)).toEqual([
      ['query', query],
      ['query_id', 'foo'],
    ])
  })

  it('should set everything', async () => {
    const query = 'SELECT * FROM system.query_log'
    const params = toSearchParams({
      database: 'some_db',
      clickhouse_settings: {
        extremes: 1,
        enable_optimize_predicate_expression: 0,
        wait_end_of_query: 1,
      },
      query_params: {
        qaz: 'qux',
      },
      session_id: 'my-session-id',
      role: ['my-role-1', 'my-role-2'],
      query_id: 'my-query-id',
      query,
    })!
    const result = toSortedArray(params)
    expect(result).toEqual([
      ['database', 'some_db'],
      ['enable_optimize_predicate_expression', '0'],
      ['extremes', '1'],
      ['param_qaz', 'qux'],
      ['query', 'SELECT * FROM system.query_log'],
      ['query_id', 'my-query-id'],
      ['role', 'my-role-1'],
      ['role', 'my-role-2'],
      ['session_id', 'my-session-id'],
      ['wait_end_of_query', '1'],
    ])
  })

  it('should set a single role', async () => {
    const query = 'SELECT * FROM system.query_log'
    const params = toSearchParams({
      query,
      database: 'some_db',
      query_id: 'my-query-id',
      role: 'single-role',
    })!
    const result = toSortedArray(params)
    expect(result).toEqual([
      ['database', 'some_db'],
      ['query', 'SELECT * FROM system.query_log'],
      ['query_id', 'my-query-id'],
      ['role', 'single-role'],
    ])
  })
})

function toSortedArray(params: URLSearchParams): [string, string][] {
  return [...params.entries()].sort(([key1], [key2]) =>
    String(key1).localeCompare(String(key2)),
  )
}
