function setupKeywords(Lang,state) {
  Lang.state.variables.set('MEL_SCRIPT', {
    CONFIG: "console"
  });
  
  // Chama as funções de setup de cada módulo
  setupData(Lang);
 setupMethods(Lang);
  setupUI(Lang);
 setupIO(Lang);
  setupNetwork(Lang);
  setupControlFlow(Lang);
  
 setupFunctions(Lang);  
 setupCanvas(Lang); 
 setupAnimation(Lang); 
 setupStorage(Lang);
 setupAudio(Lang);  
 setupTime(Lang);
 setupCrypto(Lang);
 setupThreads(Lang);

 setupWasm(Lang);
}
