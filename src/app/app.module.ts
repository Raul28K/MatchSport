import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule, 
    IonicModule.forRoot(), 
    AppRoutingModule,
    HttpClientModule
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    {
      provide: 'SQLiteConnection',
      useFactory: () => {
        const sqlite = new SQLiteConnection(CapacitorSQLite);
        if (Capacitor.getPlatform() === 'web') {
          // Configuración para web
          sqlite.initWebStore();
        }
        return sqlite;
      }
    }
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // Añadimos esto para permitir elementos web personalizados
  bootstrap: [AppComponent],
})
export class AppModule {}
