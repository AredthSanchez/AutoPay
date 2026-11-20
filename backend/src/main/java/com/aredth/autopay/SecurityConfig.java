package com.aredth.autopay;
import org.springframework.context.annotation.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
@Configuration
class SecurityConfig {
 @Bean UserDetailsService users(@Value("${autopay.username}") String name,@Value("${autopay.password}") String pass){return new InMemoryUserDetailsManager(User.withUsername(name).password("{bcrypt}"+new BCryptPasswordEncoder().encode(pass)).roles("ADMIN").build());}
 @Bean SecurityFilterChain chain(HttpSecurity http) throws Exception {
  return http.csrf(c->c.ignoringRequestMatchers("/webhooks/**")).authorizeHttpRequests(a->a.requestMatchers("/webhooks/**","/","/index.html","/assets/**","/favicon.ico").permitAll().anyRequest().authenticated()).httpBasic(Customizer.withDefaults()).build();
 }
}
