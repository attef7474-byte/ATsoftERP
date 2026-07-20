import 'dart:async';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as p;
import 'offline_queue_item.dart';

class OfflineQueueDatabase {
  static Database? _db;

  static Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _initDatabase();
    return _db!;
  }

  static Future<Database> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = p.join(dbPath, 'offline_queue.db');
    return openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            operation TEXT NOT NULL,
            endpoint TEXT NOT NULL,
            method TEXT NOT NULL,
            body TEXT,
            createdAt TEXT NOT NULL,
            retryCount INTEGER DEFAULT 0,
            status TEXT DEFAULT 'PENDING'
          )
        ''');
        await db.execute(
            'CREATE INDEX idx_status ON queue(status)');
      },
    );
  }

  static Future<int> enqueue(OfflineQueueItem item) async {
    final db = await database;
    return db.insert('queue', item.toMap());
  }

  static Future<List<OfflineQueueItem>> getPending() async {
    final db = await database;
    final maps = await db.query(
      'queue',
      where: 'status = ?',
      whereArgs: ['PENDING'],
      orderBy: 'createdAt ASC',
    );
    return maps.map((m) => OfflineQueueItem.fromMap(m)).toList();
  }

  static Future<List<OfflineQueueItem>> getAll() async {
    final db = await database;
    final maps = await db.query(
      'queue',
      orderBy: 'createdAt DESC',
    );
    return maps.map((m) => OfflineQueueItem.fromMap(m)).toList();
  }

  static Future<int> getPendingCount() async {
    final db = await database;
    final result = await db.rawQuery(
      'SELECT COUNT(*) as count FROM queue WHERE status = ?',
      ['PENDING'],
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }

  static Future<int> getFailedCount() async {
    final db = await database;
    final result = await db.rawQuery(
      'SELECT COUNT(*) as count FROM queue WHERE status = ?',
      ['FAILED'],
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }

  static Future<void> markSynced(int id) async {
    final db = await database;
    await db.update(
      'queue',
      {'status': 'SYNCED'},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static Future<void> markFailed(int id, {int? retryCount}) async {
    final db = await database;
    final values = <String, dynamic>{'status': 'FAILED'};
    if (retryCount != null) values['retryCount'] = retryCount;
    await db.update('queue', values, where: 'id = ?', whereArgs: [id]);
  }

  static Future<void> incrementRetry(int id) async {
    final db = await database;
    await db.rawUpdate(
      'UPDATE queue SET retryCount = retryCount + 1 WHERE id = ?',
      [id],
    );
  }

  static Future<void> removeSynced() async {
    final db = await database;
    await db.delete('queue', where: 'status = ?', whereArgs: ['SYNCED']);
  }

  static Future<void> clearAll() async {
    final db = await database;
    await db.delete('queue');
  }
}
