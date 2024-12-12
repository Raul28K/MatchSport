import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd, NavigationExtras } from '@angular/router';
import { MenuController, Platform, IonRouterOutlet } from '@ionic/angular';
import { filter } from 'rxjs/operators';
import { Device } from '@capacitor/device';
import { SqliteService } from './services/sqliteService/sqlite.service';
import { AuthService } from './services/authService/auth.service';
import { AvatarService } from './services/apiService/api.service';
import { App } from '@capacitor/app';


@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent implements AfterViewInit  {

  public isWeb: boolean;
  public load: boolean;
  public avatarUrl: string = '';

  username: string = '';

  @ViewChild(IonRouterOutlet) routerOutlet: IonRouterOutlet;

  constructor(
    private router: Router,
    private menuCtrl: MenuController,
    private route: ActivatedRoute,


    private platform: Platform,
    private sqlite: SqliteService,
    private authService: AuthService,
    private avatarService: AvatarService
  ) 
  {
    this.isWeb = false;
    this.load = false;
    this.initApp();
  }

  async initApp() {
    try {
      await this.platform.ready();
      const info = await Device.getInfo();
      this.isWeb = info.platform == 'web';

      await this.sqlite.init();
      
      this.sqlite.dbReady.subscribe(load => {
        this.load = load;
        if (!load) {
          this.sqlite.init();
        }
      });

      this.authService.isLoggedIn$.subscribe(isLoggedIn => {
        if (isLoggedIn) {
          const user = this.authService.getCurrentUser();
          if (user) {
            this.username = user.username;
            this.avatarUrl = this.avatarService.getAvatar(this.username);
          }
        }
      });

      App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          this.sqlite.closeConnection();
        } else {
          this.sqlite.setupDatabase();
        }
      });

    } catch (error) {
      console.error('Error en initApp:', error);
      this.sqlite.resetDatabase();
    }
  }

  ngAfterViewInit() {
    document.addEventListener('focusin', (event) => {
      const target = event.target as HTMLElement;
      
      const isInteractiveElement = target.matches('input, textarea, select, button, [contenteditable="true"], a');
      
      if (this.routerOutlet && 
          this.routerOutlet.nativeEl.contains(target) && 
          !isInteractiveElement) {
        target.blur();
      }
    });
  }

  navigateTo(page: string) {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement) {
      activeElement.blur();
    }
    
    const currentUser = this.authService.getCurrentUser();
    const navigationExtras: NavigationExtras = {
      state: {
        username: currentUser ? currentUser.username : ''
      }
    };

    this.router.navigate(['/loading']).then(() => {
      setTimeout(() => {
        switch (page) {
          case 'home':
            if (currentUser) {
              this.router.navigate(['/home'], navigationExtras);
            } else {
              this.router.navigate(['/login']);
            }
            break;
          case 'reservas':
            if (currentUser) {
              this.router.navigate(['/reservas'], navigationExtras);
            } else {
              this.router.navigate(['/login']);
            }
            break;
          case 'login':
            this.router.navigate(['/login']);
            break;
          default:
            if (currentUser) {
              this.router.navigate([`/${page}`], navigationExtras);
            } else {
              this.router.navigate(['/login']);
            }
        }
      }, 1500);
    });
    
    this.menuCtrl.close();
  }

  logout() {
    this.authService.logout();
    this.menuCtrl.close();
  }


}
