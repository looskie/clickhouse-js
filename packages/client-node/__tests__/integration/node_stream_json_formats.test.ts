import { type ClickHouseClient, isProgressRow } from '@clickhouse/client-common'
import { createSimpleTable } from '@test/fixtures/simple_table'
import { assertJsonValues, jsonValues } from '@test/fixtures/test_data'
import { createTestClient, guid } from '@test/utils'
import Stream from 'stream'
import { makeObjectStream } from '../utils/stream'

describe('[Node.js] stream JSON formats', () => {
  let client: ClickHouseClient
  let tableName: string

  beforeEach(async () => {
    client = createTestClient()
    tableName = `insert_stream_json_${guid()}`
    await createSimpleTable(client, tableName)
  })
  afterEach(async () => {
    await client.close()
  })

  it('should work with JSONEachRow', async () => {
    const stream = makeObjectStream()
    jsonValues.forEach((value) => stream.push(value))
    setTimeout(() => stream.push(null), 100)
    await client.insert({
      table: tableName,
      values: stream,
      format: 'JSONEachRow',
    })
    await assertJsonValues(client, tableName)
  })

  it('should work with JSONStringsEachRow', async () => {
    const stream = makeObjectStream()
    stream.push({ id: '42', name: 'foo', sku: '[0,1]' })
    stream.push({ id: '43', name: 'bar', sku: '[0,1,2]' })
    setTimeout(() => stream.push(null), 100)
    await client.insert({
      table: tableName,
      values: stream,
      format: 'JSONStringsEachRow',
    })
    const result = await client.query({
      query: `SELECT * FROM ${tableName} ORDER BY id ASC`,
      format: 'JSONStringsEachRow',
    })
    expect(await result.json()).toEqual([
      { id: '42', name: 'foo', sku: '[0,1]' },
      { id: '43', name: 'bar', sku: '[0,1,2]' },
    ])
  })

  describe('JSONCompactEachRow', () => {
    it('should work with JSONCompactEachRow', async () => {
      const stream = makeObjectStream()
      stream.push(['42', 'foo', [0, 1]])
      stream.push(['43', 'bar', [2, 3]])
      setTimeout(() => stream.push(null), 100)
      await client.insert({
        table: tableName,
        values: stream,
        format: 'JSONCompactEachRow',
      })
      const result = await client.query({
        query: `SELECT * FROM ${tableName} ORDER BY id ASC`,
        format: 'JSONCompactEachRow',
      })
      expect(await result.json()).toEqual([
        ['42', 'foo', [0, 1]],
        ['43', 'bar', [2, 3]],
      ])
    })

    it('should work with JSONCompactStringsEachRow', async () => {
      const stream = makeObjectStream()
      stream.push(['42', 'foo', '[0,1]'])
      stream.push(['43', 'bar', '[2,3]'])
      setTimeout(() => stream.push(null), 100)
      await client.insert({
        table: tableName,
        values: stream,
        format: 'JSONCompactStringsEachRow',
      })
      const result = await client.query({
        query: `SELECT * FROM ${tableName} ORDER BY id ASC`,
        format: 'JSONCompactStringsEachRow',
      })
      expect(await result.json()).toEqual([
        ['42', 'foo', '[0,1]'],
        ['43', 'bar', '[2,3]'],
      ])
    })

    it('should work with JSONCompactEachRowWithNames', async () => {
      const stream = makeObjectStream()
      stream.push(['id', 'name', 'sku'])
      stream.push(['42', 'foo', [0, 1]])
      stream.push(['43', 'bar', [2, 3]])
      setTimeout(() => stream.push(null), 100)
      await client.insert({
        table: tableName,
        values: stream,
        format: 'JSONCompactEachRowWithNames',
      })
      const result = await client.query({
        query: `SELECT * FROM ${tableName} ORDER BY id ASC`,
        format: 'JSONCompactEachRowWithNames',
      })
      expect(await result.json()).toEqual([
        ['id', 'name', 'sku'],
        ['42', 'foo', [0, 1]],
        ['43', 'bar', [2, 3]],
      ])
    })

    it('should work with JSONCompactEachRowWithNamesAndTypes', async () => {
      const stream = makeObjectStream()
      stream.push(['id', 'name', 'sku'])
      stream.push(['UInt64', 'String', 'Array(UInt8)'])
      stream.push(['42', 'foo', [0, 1]])
      stream.push(['43', 'bar', [2, 3]])
      setTimeout(() => stream.push(null), 100)
      await client.insert({
        table: tableName,
        values: stream,
        format: 'JSONCompactEachRowWithNamesAndTypes',
      })
      const result = await client.query({
        query: `SELECT * FROM ${tableName} ORDER BY id ASC`,
        format: 'JSONCompactEachRowWithNamesAndTypes',
      })
      expect(await result.json()).toEqual([
        ['id', 'name', 'sku'],
        ['UInt64', 'String', 'Array(UInt8)'],
        ['42', 'foo', [0, 1]],
        ['43', 'bar', [2, 3]],
      ])
    })

    it('should insert data with a wrong name in JSONCompactEachRowWithNamesAndTypes', async () => {
      const stream = makeObjectStream()
      stream.push(['foo', 'name', 'sku'])
      stream.push(['UInt64', 'String', 'Array(UInt8)'])
      stream.push(['42', 'foo', [0, 1]])
      stream.push(['43', 'bar', [2, 3]])
      setTimeout(() => stream.push(null), 100)

      await client.insert({
        table: tableName,
        values: stream,
        format: 'JSONCompactEachRowWithNamesAndTypes',
      })
      const result = await client.query({
        query: `SELECT * FROM ${tableName} ORDER BY id ASC`,
        format: 'JSONCompactEachRowWithNamesAndTypes',
      })
      expect(await result.json()).toEqual([
        ['id', 'name', 'sku'],
        ['UInt64', 'String', 'Array(UInt8)'],
        ['0', 'foo', [0, 1]],
        ['0', 'bar', [2, 3]],
      ])
    })

    it('should throw an exception when insert data with a wrong type in JSONCompactEachRowWithNamesAndTypes', async () => {
      const stream = makeObjectStream()
      stream.push(['id', 'name', 'sku'])
      stream.push(['UInt64', 'UInt64', 'Array(UInt8)'])
      stream.push(['42', 'foo', [0, 1]])
      stream.push(['43', 'bar', [2, 3]])
      setTimeout(() => stream.push(null), 100)

      const insertPromise = client.insert({
        table: tableName,
        values: stream,
        format: 'JSONCompactEachRowWithNamesAndTypes',
      })
      await expectAsync(insertPromise).toBeRejectedWith(
        jasmine.objectContaining({
          message: jasmine.stringMatching(
            `Type of 'name' must be String, not UInt64`,
          ),
        }),
      )
    })

    it('should work with JSONCompactStringsEachRowWithNames', async () => {
      const stream = makeObjectStream()
      stream.push(['id', 'name', 'sku'])
      stream.push(['42', 'foo', '[0,1]'])
      stream.push(['43', 'bar', '[2,3]'])
      setTimeout(() => stream.push(null), 100)
      await client.insert({
        table: tableName,
        values: stream,
        format: 'JSONCompactStringsEachRowWithNames',
      })
      const result = await client.query({
        query: `SELECT * FROM ${tableName} ORDER BY id ASC`,
        format: 'JSONCompactStringsEachRowWithNames',
      })
      expect(await result.json()).toEqual([
        ['id', 'name', 'sku'],
        ['42', 'foo', '[0,1]'],
        ['43', 'bar', '[2,3]'],
      ])
    })

    it('should work with JSONCompactStringsEachRowWithNamesAndTypes', async () => {
      const stream = makeObjectStream()
      stream.push(['id', 'name', 'sku'])
      stream.push(['UInt64', 'String', 'Array(UInt8)'])
      stream.push(['42', 'foo', '[0,1]'])
      stream.push(['43', 'bar', '[2,3]'])
      setTimeout(() => stream.push(null), 100)
      await client.insert({
        table: tableName,
        values: stream,
        format: 'JSONCompactStringsEachRowWithNamesAndTypes',
      })
      const result = await client.query({
        query: `SELECT * FROM ${tableName} ORDER BY id ASC`,
        format: 'JSONCompactStringsEachRowWithNamesAndTypes',
      })
      expect(await result.json()).toEqual([
        ['id', 'name', 'sku'],
        ['UInt64', 'String', 'Array(UInt8)'],
        ['42', 'foo', '[0,1]'],
        ['43', 'bar', '[2,3]'],
      ])
    })
  })

  xdescribe('JSONEachRowWithProgress', () => {
    it('should work', async () => {
      const limit = 2
      const expectedProgressRowsCount = 4
      const rs = await client.query({
        query: `SELECT number FROM system.numbers LIMIT ${limit}`,
        format: 'JSONEachRowWithProgress',
        clickhouse_settings: {
          max_block_size: '1', // reduce the block size, so the progress is reported more frequently
        },
      })
      const rows = await rs.json<{ number: 'string' }>()
      expect(rows.length).toEqual(limit + expectedProgressRowsCount)
      expect(rows.filter((r) => !isProgressRow(r)) as unknown[]).toEqual([
        { row: { number: '0' } },
        { row: { number: '1' } },
      ])
    })
  })

  it('does not throw if stream closes prematurely', async () => {
    const stream = new Stream.Readable({
      objectMode: true,
      read() {
        this.push(null) // close stream
      },
    })

    await expectAsync(
      client.insert({
        table: tableName,
        values: stream,
      }),
    ).toBeResolved()
  })

  it('waits for stream of values to be closed', async () => {
    let closed = false
    const stream = new Stream.Readable({
      objectMode: true,
      read() {
        setTimeout(() => {
          this.push([42, 'hello', [0, 1]])
          this.push([43, 'world', [3, 4]])
          this.push(null)
          closed = true
        }, 100)
      },
    })

    expect(closed).toBe(false)
    await client.insert({
      table: tableName,
      values: stream,
    })
    expect(closed).toBe(true)
  })

  it('can insert multiple streams at once', async () => {
    const streams: Stream.Readable[] = Array(jsonValues.length)
    const insertStreamPromises = Promise.all(
      jsonValues.map((value, i) => {
        const stream = makeObjectStream()
        streams[i] = stream
        stream.push(value)
        return client.insert({
          values: stream,
          format: 'JSONEachRow',
          table: tableName,
        })
      }),
    )
    setTimeout(() => {
      streams.forEach((stream) => stream.push(null))
    }, 100)
    await insertStreamPromises
    await assertJsonValues(client, tableName)
  })

  it('should throw in case of an invalid format of data', async () => {
    const stream = makeObjectStream()
    stream.push({ id: 'baz', name: 'foo', sku: '[0,1]' })
    stream.push(null)
    await expectAsync(
      client.insert({
        table: tableName,
        values: stream,
        format: 'JSONEachRow',
      }),
    ).toBeRejectedWith(
      jasmine.objectContaining({
        message: jasmine.stringContaining('Cannot parse input'),
      }),
    )
  })
})
