import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CapacitorSQLite, capSQLiteValues, JsonSQLite } from '@capacitor-community/sqlite';
import { Device } from '@capacitor/device';
import { Preferences } from '@capacitor/preferences';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class SqliteService {

  public dbReady: BehaviorSubject<boolean>;
  public isWeb: boolean;
  public isIOS: boolean;
  public dbName: string;
  private hasConnection = false;



  constructor(private http: HttpClient) {
    this.dbReady = new BehaviorSubject(false);
    this.isWeb = false;
    this.isIOS = false;
    this.dbName = '';
   }


   async init() {
    try {
      const info = await Device.getInfo();
      const sqlite = CapacitorSQLite as any;

      if (info.platform == 'android') {
        try {
          await sqlite.requestPermissions();
        } catch (error) {
          console.error("Esta app necesita permisos para funcionar");
        }
      } else if (info.platform == 'web') {
        this.isWeb = true;
        await sqlite.initWebStore();
      } else if (info.platform == 'ios') {
        this.isIOS = true;
      }

      await this.setupDatabase();
    } catch (error) {
      console.error('Error en init:', error);
    }
  }

  async setupDatabase() {
    try {
      await this.closeConnection();
      
      const dbSetup = await Preferences.get({ key: 'first_setup_key' });

      if (!dbSetup.value) {
        await this.downloadDatabase();
      } else {
        this.dbName = await this.getDbName();
        
        try {
          await CapacitorSQLite.checkConnectionsConsistency({
            dbNames: [this.dbName],
            openModes: ['RW']
          });

          try {
            await CapacitorSQLite.closeConnection({ database: this.dbName });
          } catch (e) {
          }

          await CapacitorSQLite.createConnection({ database: this.dbName });
          
          await CapacitorSQLite.open({ database: this.dbName });
          
          const queryResult = await CapacitorSQLite.query({
            database: this.dbName,
            statement: 'SELECT * FROM usuarios LIMIT 1',
            values: []
          });

          if (queryResult && queryResult.values && queryResult.values.length >= 0) {
            this.hasConnection = true;
            this.dbReady.next(true);
          } else {
            throw new Error('No se pudo verificar la tabla usuarios');
          }

        } catch (error) {
          console.error('Error verificando tabla usuarios:', error);
          await this.resetDatabase();
        }
      }
    } catch (error) {
      console.error('Error en setupDatabase:', error);
      await this.resetDatabase();
    }
  }

  async closeConnection() {
    try {
      if (this.dbName && this.hasConnection) {
        await CapacitorSQLite.closeConnection({ database: this.dbName });
        this.hasConnection = false;
      }
    } catch (error) {
      console.error('Error cerrando conexión:', error);
    }
  }

  async downloadDatabase() {
    try {
        const jsonExport = await this.http.get('assets/db/db.json').toPromise() as JsonSQLite;
        const jsonstring = JSON.stringify(jsonExport);

        const isValid = await CapacitorSQLite.isJsonValid({ jsonstring });
        
        if (!isValid.result) {
            throw new Error('JSON no válido para SQLite');
        }

        this.dbName = jsonExport.database;
        
        await CapacitorSQLite.importFromJson({ jsonstring });
                
        await CapacitorSQLite.createConnection({ database: this.dbName });
        await CapacitorSQLite.open({ database: this.dbName });

        if (this.isWeb) {
            await CapacitorSQLite.saveToStore({ database: this.dbName });
        }

        await Preferences.set({ key: 'first_setup_key', value: '1' });
        await Preferences.set({ key: 'dbname', value: this.dbName });

        this.hasConnection = true;
        this.dbReady.next(true);
    } catch (error) {
        console.error('Error al inicializar la base de datos:', error);
        throw error;
    }
  }

  async getDbName() {

    if (!this.dbName) {
      const dbname = await Preferences.get({ key: 'dbname' })
      if (dbname.value) {
        this.dbName = dbname.value
      }
    }
    return this.dbName;
  }

  async ensureConnection() {
    if (!this.hasConnection && this.dbName) {
      try {
        await CapacitorSQLite.createConnection({ database: this.dbName });
        await CapacitorSQLite.open({ database: this.dbName });
        this.hasConnection = true;
      } catch (error) {
        console.error('Error al reconectar:', error);
        throw error;
      }
    }
  }

  async readDeporte(deporteId: number) {
    await this.ensureConnection();
    const sql = 'SELECT * FROM deportes WHERE deporte_id = ?';
    
    try {
      const result = await CapacitorSQLite.query({
        database: this.dbName,
        statement: sql,
        values: [deporteId.toString()]
      });

      if (this.isIOS && result.values.length > 0) {
        result.values.shift();
      }
      return result.values.length > 0 ? result.values[0] : null;
    } catch (error) {
      console.error('Error en readDeporte:', error);
      throw error;
    }
  }

  async readEncuentros(deporteId: number, fecha: string) {
    let sql = `
      SELECT e.*, d.nombre as deporte_nombre 
      FROM encuentros e 
      JOIN deportes d ON e.deporte_id = d.deporte_id 
      WHERE e.deporte_id = ? AND e.fecha = ?
    `;
    const dbName = await this.getDbName();

    return CapacitorSQLite.query({
      database: dbName,
      statement: sql,
      values: [deporteId, fecha]
    }).then((response: capSQLiteValues) => {
      if (this.isIOS && response.values.length > 0) {
        response.values.shift();
      }
      return response.values;
    }).catch(err => {
      console.error('Error en readEncuentros:', err);
      return Promise.reject(err);
    });
  }

  async readBares(barId: number) {
    let sql = `SELECT * FROM bar WHERE bar_id = ?`;
    const dbName = await this.getDbName();

    return CapacitorSQLite.query({
      database: dbName,
      statement: sql,
      values: [barId]
    }).then((response: capSQLiteValues) => {
      if (this.isIOS && response.values.length > 0) {
        response.values.shift();
      }
      return response.values;
    }).catch(err => {
      console.error('Error en readBares:', err);
      return Promise.reject(err);
    });
  }

  
  async readEncuentroBar(encuentroId: number) {
    let sql = `
      SELECT * FROM encuentro_bar WHERE encuentro_id = ? 
    `;
    const dbName = await this.getDbName();

    return CapacitorSQLite.query({
      database: dbName,
      statement: sql,
      values: [encuentroId]
    }).then((response: capSQLiteValues) => {
      if (this.isIOS && response.values.length > 0) {
        response.values.shift();
      }
      return response.values;
    }).catch(err => {
      console.error('Error en readEncuentroBar:', err);
      return Promise.reject(err);
    });
    ;
  }

  async createReserva(reserva: {
    username: string;
    encuentro_id: number;
    bar_id: number;
    cantidad_personas: number;
    fecha_reserva: string;
  }) {
    try {
      const sql = `
        INSERT INTO reservas (
          username, 
          encuentro_id, 
          bar_id, 
          cantidad_personas, 
          fecha_reserva
        ) 
        VALUES (?, ?, ?, ?, ?)
      `;

      const dbName = await this.getDbName();
      
      const result = await CapacitorSQLite.executeSet({
        database: dbName,
        set: [{
          statement: sql,
          values: [
            reserva.username,
            reserva.encuentro_id,
            reserva.bar_id,
            reserva.cantidad_personas,
            reserva.fecha_reserva
          ]
        }]
      });

      if (this.isWeb) {
        await CapacitorSQLite.saveToStore({ database: dbName });
      }

      return { success: true, reserva: reserva };

    } catch (error) {
      console.error('Error al crear reserva en SQLite:', error);
      return Promise.reject(error);
    }
  }

  async getReservasByUsername(username: string) {
    try {
      const sql = `
        SELECT r.*, 
               e.nombre as encuentroNombre,
               e.fecha,
               d.nombre as deporte,
               b.nombre as barNombre,
               b.direccion as barDireccion
        FROM reservas r
        JOIN encuentros e ON r.encuentro_id = e.encuentro_id
        JOIN deportes d ON e.deporte_id = d.deporte_id
        JOIN bar b ON r.bar_id = b.bar_id
        WHERE r.username = ?
      `;

      const dbName = await this.getDbName();

      const result = await CapacitorSQLite.query({
        database: dbName,
        statement: sql,
        values: [username]
      });

      if (this.isIOS && result.values.length > 0) {
        result.values.shift();
      }
      return result.values;

    } catch (error) {
      console.error('Error al obtener reservas de SQLite:', error);
      return [];
    }
  }

  async clearReservas() {
    localStorage.removeItem('reservas');
    return { success: true };
  }

  async getUserByUsername(username: string) {
    const sql = 'SELECT * FROM usuarios WHERE username = ?';
    const dbName = await this.getDbName();

    return CapacitorSQLite.query({
      database: dbName,
      statement: sql,
      values: [username]
    }).then((response: capSQLiteValues) => {
      if (this.isIOS && response.values.length > 0) {
        response.values.shift();
      }
      return response.values.length > 0 ? response.values[0] : null;
    }).catch(err => {
      console.error('Error al obtener usuario:', err);
      return Promise.reject(err);
    });
  }

  async resetDatabase() {
    try {
      await this.closeConnection();
      await Preferences.remove({ key: 'first_setup_key' });
      await Preferences.remove({ key: 'dbname' });

      if (this.isWeb) {
        await CapacitorSQLite.deleteDatabase({ database: this.dbName });
      }

      this.dbName = '';
      this.hasConnection = false;
      this.dbReady.next(false);
      
      window.location.reload();
    } catch (error) {
      console.error('Error reseteando la base de datos:', error);
    }
  }

}
