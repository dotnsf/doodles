function createhttpRequest(){
  if( window.ActiveXObject ){
    try{
      return new ActiveXObject( "Msxml2.XMLHTTP" );
    }catch( e ){
      try{
        return new ActiveXObject( "Microsoft.XMLHTTP" );
      }catch( e2 ){
        return null;
      }
    }
  }else if( window.XMLHttpRequest ){
    return new XMLHttpRequest();
  }else{
    return null;
  }
}

function sleep( msec ){
	var d1 = new Date().getTime();
	var d2 = new Date().getTime();
	while( d2 < d1 + msec ){
		d2 = new Date().getTime();
	}

	return;
}

function getBrowserWidth(){
	if( window.innerWidth ){
		return window.innerWidth;
	}else if( document.documentElement && document.documentElement.clientWidth != 0 ){
		return document.documentElement.clientWidth;
	}else if( document.body ){
		return document.body.clientWidth;
	}

	return 900;
}

function getBrowserHeight(){
	if( window.innerHeight ){
		return window.innerHeight;
	}else if( document.documentElement && document.documentElement.clientHeight != 0 ){
		return document.documentElement.clientHeight;
	}else if( document.body ){
		return document.body.clientHeight;
	}

	return 550;
}

function getMobileBrowserWidth(){
	if( window.innerWidth ){
		return window.innerWidth;
	}else if( document.documentElement && document.documentElement.clientWidth != 0 ){
		return document.documentElement.clientWidth;
	}else if( document.body ){
		return document.body.clientWidth;
	}
}

function getMobileBrowserHeight(){
	if( window.innerHeight ){
		return window.innerHeight;
	}else if( document.documentElement && document.documentElement.clientHeight != 0 ){
		return document.documentElement.clientHeight;
	}else if( document.body ){
		return document.body.clientHeight;
	}
}


function DT2D( dt ){
	var v = "" + dt;
	var d = "";
	try{
		var d_t = v.split( " " );
		d = d_t[0];
	}catch( e ){
	}

	return d;
}

function DT2T( dt ){
	var v = "" + dt;
	var t = "";
	try{
		var d_t = v.split( " " );
		t = d_t[1];
	}catch( e ){
	}

	return t;
}
