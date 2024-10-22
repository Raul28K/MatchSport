import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { HttpClient } from '@angular/common/http';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root'
})
export class SqliteService {
  public dbReady: BehaviorSubject<boolean> = new BehaviorSubject(false);
  public isWeb: boolean = Capacitor.getPlatform() === 'web';
  public dbName: string = 'my_database';
  private sqlite: SQLiteConnection;
  private db: SQLiteDBConnection | null = null;

  constructor(private http: HttpClient) {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
  }

  async init(): Promise<void> {
    console.log('SqliteService: Iniciando inicialización');
    try {
      if (this.isWeb) {
        console.log('SqliteService: Inicializando para web');
        await this.waitForJeepSqlite();
        await customElements.whenDefined('jeep-sqlite');
        const jeepSqlite = document.querySelector('jeep-sqlite') as JeepSQLiteElement;
        if (jeepSqlite) {
          await jeepSqlite.initWebStore();
        }
      }

      console.log('SqliteService: Configurando la base de datos');
      this.db = await this.sqlite.createConnection(this.dbName, false, 'no-encryption', 1, false);
      await this.db.open();
      console.log('SqliteService: Inicialización completada');
      this.dbReady.next(true);
    } catch (error) {
      console.error('SqliteService: Error durante la inicialización:', error);
      this.dbReady.next(false);
      throw error;
    }
  }

  private async waitForJeepSqlite(maxAttempts = 10, interval = 1000): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (customElements.get('jeep-sqlite')) {
        console.log('SqliteService: Elemento jeep-sqlite encontrado');
        return;
      }
      console.log(`SqliteService: Esperando jeep-sqlite, intento ${attempt + 1}`);
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('Timeout esperando jeep-sqlite');
  }

  async setupDatabase() {
    console.log('SqliteService: Configurando base de datos');
    try {
      const dbSetup = await Preferences.get({key: 'first_setup_key'});

      if (!dbSetup.value) {
        console.log('SqliteService: Primera configuración, importando desde JSON');
        await this.importFromJson();
      } else {
        console.log('SqliteService: Base de datos ya configurada, abriendo conexión');
        this.db = await this.sqlite.createConnection(this.dbName, false, 'no-encryption', 1, false);
        await this.db.open();
      }
      console.log('SqliteService: Configuración de base de datos completada');
    } catch (error) {
      console.error('SqliteService: Error configurando la base de datos:', error);
      throw error;
    }
  }

  async importFromJson() {
    console.log('SqliteService: Importando base de datos desde JSON');
    try {
      const jsonString = await this.getJsonString();
      const isValid = await this.sqlite.isJsonValid(jsonString);

      if(isValid.result) {
        const jsonObj = JSON.parse(jsonString);
        this.dbName = jsonObj.database;
        await this.sqlite.importFromJson(jsonString);
        this.db = await this.sqlite.createConnection(this.dbName, false, 'no-encryption', 1, false);
        await this.db.open();

        await Preferences.set({key: 'first_setup_key', value: '1'});
        console.log('SqliteService: Importación desde JSON completada');
      } else {
        throw new Error('JSON inválido');
      }
    } catch (error) {
      console.error('SqliteService: Error importando la base de datos:', error);
      throw error;
    }
  }

  private async getJsonString(): Promise<string> {
    try {
      console.log('SqliteService: Obteniendo JSON de la base de datos');
      const response = await this.http.get('assets/db/db.json').toPromise();
      console.log('SqliteService: JSON obtenido correctamente');
      return JSON.stringify(response);
    } catch (error) {
      console.error('SqliteService: Error al obtener el JSON de la base de datos:', error);
      throw error;
    }
  }

  async authenticateUser(username: string, password: string): Promise<boolean> {
    console.log('SqliteService: Iniciando autenticación para', username);
    try {
      await this.ensureDbReady();
      if (!this.db) throw new Error('Database connection not established');
      
      const query = 'SELECT * FROM usuario WHERE nombreUsuario = ? AND passUsuario = ?';
      const result = await this.db.query(query, [username, password]);
      
      const isAuthenticated = result.values && result.values.length > 0;
      console.log('SqliteService: Usuario autenticado:', isAuthenticated);
      
      return isAuthenticated;
    } catch (error) {
      console.error('SqliteService: Error autenticando usuario:', error);
      throw error;
    }
  }

  async checkUsers() {
    try {
      await this.ensureDbReady();
      if (!this.db) throw new Error('Database connection not established');
      
      const result = await this.db.query('SELECT * FROM usuario');
      console.log('Usuarios en la base de datos:', result.values);
    } catch (error) {
      console.error('Error al verificar usuarios:', error);
    }
  }

  private async ensureDbReady(timeout = 30000): Promise<void> {
    if (!this.dbReady.value) {
      console.log('SqliteService: Esperando a que la base de datos esté lista');
      return new Promise<void>((resolve, reject) => {
        const subscription = this.dbReady.subscribe({
          next: (ready) => {
            if (ready) {
              console.log('SqliteService: Base de datos lista');
              subscription.unsubscribe();
              resolve();
            }
          },
          error: (err) => {
            console.error('SqliteService: Error al esperar que la base de datos esté lista:', err);
            subscription.unsubscribe();
            reject(err);
          }
        });

        setTimeout(() => {
          subscription.unsubscribe();
          reject(new Error('Database initialization timeout'));
        }, timeout);
      });
    } else {
      console.log('SqliteService: La base de datos ya está lista');
    }
  }

  // Métodos CRUD
  async create(table: string, data: any): Promise<number> {
    await this.ensureDbReady();
    if (!this.db) throw new Error('Database connection not established');

    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(',');
    const query = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`;

    const result = await this.db.run(query, values);
    return result.changes?.lastId || 0;
  }

  async read(table: string, condition?: string, params?: any[]): Promise<any[]> {
    await this.ensureDbReady();
    if (!this.db) throw new Error('Database connection not established');

    let query = `SELECT * FROM ${table}`;
    if (condition) {
      query += ` WHERE ${condition}`;
    }

    const result = await this.db.query(query, params);
    return result.values || [];
  }

  async update(table: string, data: any, condition: string, params?: any[]): Promise<number> {
    await this.ensureDbReady();
    if (!this.db) throw new Error('Database connection not established');

    const setClause = Object.keys(data).map(key => `${key} = ?`).join(',');
    const values = [...Object.values(data), ...(params || [])];
    const query = `UPDATE ${table} SET ${setClause} WHERE ${condition}`;

    const result = await this.db.run(query, values);
    return result.changes?.changes || 0;
  }

  async delete(table: string, condition: string, params?: any[]): Promise<number> {
    await this.ensureDbReady();
    if (!this.db) throw new Error('Database connection not established');

    const query = `DELETE FROM ${table} WHERE ${condition}`;
    const result = await this.db.run(query, params);
    return result.changes?.changes || 0;
  }

  // Método para ejecutar consultas personalizadas
  async executeQuery(query: string, params?: any[]): Promise<any> {
    await this.ensureDbReady();
    if (!this.db) throw new Error('Database connection not established');

    return this.db.query(query, params);
  }
}
