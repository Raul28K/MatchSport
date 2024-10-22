import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/authService/auth.service';
import { IonicModule } from '@ionic/angular';
import { AlertController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { AppComponent } from 'src/app/app.component';
import { ReservaService } from 'src/app/services/reservaService/reserva.service';
import { CommonModule } from '@angular/common';
import { SqliteService } from 'src/app/services/sqliteService/sqlite.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class LoginComponent implements OnInit {
  username: string = '';
  password: string = '';
  isWeb: boolean = false;

  constructor(
    private alertController: AlertController, 
    private router: Router, 
    private appComponent: AppComponent,
    private authService: AuthService,
    private sqliteService: SqliteService
  ) {}

  ngOnInit() {
    this.isWeb = this.appComponent.isWeb;
    this.sqliteService.checkUsers();
  }

  clearFields() {
    this.username = '';
    this.password = '';
  }

  async login() {
    console.log('LoginComponent: Intentando login con:', this.username, this.password);
    try {
      const success = await this.authService.login(this.username, this.password);
      if (success) {
        console.log('LoginComponent: Login exitoso');
        this.router.navigate(['/loading']);
        setTimeout(() => {
          this.router.navigate(['/home']);
        }, 1500);  
      } else {
        console.error('LoginComponent: Credenciales incorrectas');
        const alert = await this.alertController.create({
          header: 'Error de login',
          message: 'Usuario o contraseña incorrectos',
          buttons: ['OK']
        });
        await alert.present();
      }
    } catch (error) {
      console.error('LoginComponent: Error en el login:', error);
      const alert = await this.alertController.create({
        header: 'Error',
        message: 'Ocurrió un error durante el login. Por favor, intente de nuevo.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  goToRecuperarPass() {
    this.router.navigate(['/loading']);
    setTimeout(() => {
      this.router.navigate(['/login/recuperar-pass']);
    }, 1500);
  }
}
