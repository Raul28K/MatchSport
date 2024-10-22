import { Injectable } from '@angular/core';
import { SqliteService } from '../sqliteService/sqlite.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  nombreUsuario: string | null = null;

  constructor(private sqliteService: SqliteService) {}

  async login(username: string, password: string): Promise<boolean> {
    console.log('AuthService: Iniciando login para', username);
    try {
      const isAuthenticated = await this.sqliteService.authenticateUser(username, password);
      console.log('AuthService: Resultado de autenticación:', isAuthenticated);
      if (isAuthenticated) {
        this.nombreUsuario = username;
        console.log('AuthService: Login exitoso para', username);
        return true;
      } else {
        console.log('AuthService: Login fallido para', username);
        return false;
      }
    } catch (error) {
      console.error('AuthService: Error durante el login:', error);
      return false;
    }
  }

  logout() {
    this.nombreUsuario = null;
  }

  isLoggedIn(): boolean {
    return this.nombreUsuario !== null;
  }
}
