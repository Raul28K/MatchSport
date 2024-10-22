import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { MenuController, Platform } from '@ionic/angular';
import { ReservaService } from './services/reservaService/reserva.service';
import { filter } from 'rxjs/operators';
import { Device } from '@capacitor/device';
import { SqliteService } from './services/sqliteService/sqlite.service';
import { Capacitor } from '@capacitor/core';
import { AuthService } from './services/authService/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent implements OnInit {
  username: string = '';
  password: string = '';
  deporte: string = '';
  fecha: string = '';
  barNombre: string = '';
  encuentroNombre: string = '';
  cantidadPersonas: number = 0;
  barDireccion: string = '';
  public isWeb: boolean = Capacitor.getPlatform() === 'web';
  public load: boolean;


  constructor(
    private router: Router,
    private menuCtrl: MenuController,
    private route: ActivatedRoute,
    private reservaService: ReservaService,
    private platform: Platform,
    private sqliteService: SqliteService,
    private authService: AuthService
  ) {
    this.load = false;
    this.initApp();
  }

  async ngOnInit() {
    try {
      if (this.sqliteService.isWeb) {
        await customElements.whenDefined('jeep-sqlite');
        const jeepSqlite = document.querySelector('jeep-sqlite') as JeepSQLiteElement;
        if (jeepSqlite) {
          await jeepSqlite.initWebStore();
        }
      }
      await this.sqliteService.init();
      console.log('AppComponent: Base de datos inicializada correctamente');
      await this.sqliteService.checkUsers();
    } catch (error) {
      console.error('AppComponent: Error al inicializar la base de datos:', error);
    }
  }

  async initApp() {
    await this.platform.ready();
    try {
      await this.sqliteService.init();
      console.log('Base de datos inicializada correctamente');
    } catch (error) {
      console.error('Error al inicializar la base de datos:', error);
    }
  }

  updateUsernameFromRoute() {
    const userData = this.reservaService.getUserData();
    if (userData && userData.username) {
      this.username = userData.username;
    } else {
      this.username = this.route.snapshot.paramMap.get('username') || '';
      if (this.username) {
        this.reservaService.setUserData({ username: this.username });
      }
    }
  }

  async checkDatabaseReady(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.load) {
        resolve(true);
      } else {
        const subscription = this.sqliteService.dbReady.subscribe((ready) => {
          if (ready) {
            subscription.unsubscribe();
            resolve(true);
          }
        });
      }
    });
  }

  /*Funciones del menu*/
  navigateTo(page: string) {
    this.router.navigate(['/loading']);
    setTimeout(() => {
      const reservaData = this.reservaService.getReservaData();
      const navigationExtras = { ...reservaData, username: this.username };
      
      switch (page) {
        case 'home':
          this.router.navigate(['/home', navigationExtras]);
          break;
        case 'reservas':
          this.router.navigate(['/reservas', navigationExtras]);
          break;
        case 'login':
          this.router.navigate(['/login']);
          break;
        default:
          this.router.navigate([`/${page}`, navigationExtras]);
      }
    }, 1500);
    this.menuCtrl.close();
  }

  logout() {
    this.username = '';
    this.authService.logout();
    this.router.navigate(['/login']);
    this.menuCtrl.close();
  }




}
